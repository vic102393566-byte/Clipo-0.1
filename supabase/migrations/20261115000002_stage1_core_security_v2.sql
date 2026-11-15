-- ============================================================================
-- CLIPO — MIGRAÇÃO SQL CORRIGIDA E ENDURECIDA (ETAPA 1 — V2)
-- Arquivo: supabase/migrations/20261115000002_stage1_core_security_v2.sql
--
-- MELHORIAS SOBRE A V1 (20261115000001_stage1_core_security.sql):
-- 1. Remove criação desnecessária de extensões em schema 'public' (usa gen_random_uuid() nativo).
-- 2. Garante evolução segura de colunas usadas em índices (storage_provider, created_at, etc.)
--    sem sobrescrever registros antigos com valores incorretos (ex.: não marca vídeos legados como 'r2').
-- 3. Limpa TODAS as políticas RLS pré-existentes nas tabelas-alvo do schema 'public' e
--    políticas de 'clipo-videos' em storage.objects para evitar bypass por OR permissivo.
-- 4. Revoga permissões de PUBLIC, anon e authenticated antes de conceder privilégios mínimos,
--    incluindo GRANT ALL explícito para service_role em TODAS as 11 tabelas.
-- 5. Aplica políticas RLS adaptativas por tipo real da coluna (uuid nativo quando UUID para
--    preservar uso de índice B-tree; ::text quando VARCHAR legado).
-- 6. Corrige handle_new_auth_user() com SQL dinâmico seguro para UUID/VARCHAR, tratamento de
--    conflito de email sem bloquear signup, sincronização de UPDATE de email e backfill idempotente.
-- 7. Protege alteração de plano/assinatura/cota em BEFORE INSERT OR UPDATE + REVOKE em colunas
--    sensíveis (incluindo email/plan_id em users e plan_name em user_settings).
-- 8. Valida FKs condicionais por (data_type + length + ausência de FK prévia na coluna) com NOT VALID
--    para não falhar diante de registros órfãos históricos.
-- ============================================================================

BEGIN;

-- ============================================================================
-- FUNÇÕES UTILITÁRIAS E TRIGGERS GERAIS
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Impede que qualquer cliente (anon/authenticated) insira ou altere plano,
-- assinatura, cota R2 ou campos controlados exclusivamente pelo backend/webhook.
CREATE OR REPLACE FUNCTION public.prevent_client_plan_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jwt_role TEXT := COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    auth.role()::text,
    ''
  );
BEGIN
  IF v_jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.plan_id, 'basico') <> 'basico'
       OR COALESCE(NEW.subscription_status, 'ativa') <> 'ativa'
       OR NEW.renews_at IS NOT NULL
       OR NEW.last_payment_id IS NOT NULL
       OR COALESCE(NEW.r2_used_bytes, 0) <> 0 THEN
      RAISE EXCEPTION 'Permissão negada: não é permitido definir plano ou assinatura diretamente pelo cliente.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.plan_id IS DISTINCT FROM OLD.plan_id
     OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     OR NEW.renews_at IS DISTINCT FROM OLD.renews_at
     OR NEW.last_payment_id IS DISTINCT FROM OLD.last_payment_id
     OR NEW.payment_method IS DISTINCT FROM OLD.payment_method
     OR NEW.billing_interval IS DISTINCT FROM OLD.billing_interval
     OR NEW.r2_used_bytes IS DISTINCT FROM OLD.r2_used_bytes THEN
    RAISE EXCEPTION 'Permissão negada: plano, assinatura e cota só podem ser alterados pelo servidor/webhook autorizado.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_client_plan_mutation() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 1. TABELA DE PLANOS DE ASSINATURA (subscription_plans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  monthly_limit_bytes BIGINT NOT NULL,
  label_limit VARCHAR(32) NOT NULL,
  monthly_video_limit INT NOT NULL,
  label_video_limit VARCHAR(64) NOT NULL,
  max_video_duration_seconds INT NOT NULL DEFAULT 1800,
  max_file_size_bytes BIGINT NOT NULL DEFAULT 2147483648,
  price_monthly NUMERIC(10, 2) NOT NULL,
  max_social_accounts INT NOT NULL DEFAULT 1,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evolução não-destrutiva: adiciona como NULL primeiro para não sobrescrever políticas customizadas
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_video_duration_seconds INT,
  ADD COLUMN IF NOT EXISTS max_file_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Preenche apenas linhas que ainda estavam NULL
UPDATE public.subscription_plans
SET
  max_video_duration_seconds = COALESCE(max_video_duration_seconds, CASE id WHEN 'pro' THEN 7200 WHEN 'premium' THEN 14400 ELSE 1800 END),
  max_file_size_bytes = COALESCE(max_file_size_bytes, CASE id WHEN 'pro' THEN 10737418240 WHEN 'premium' THEN 26843545600 ELSE 2147483648 END)
WHERE max_video_duration_seconds IS NULL OR max_file_size_bytes IS NULL;

ALTER TABLE public.subscription_plans
  ALTER COLUMN max_video_duration_seconds SET DEFAULT 1800,
  ALTER COLUMN max_video_duration_seconds SET NOT NULL,
  ALTER COLUMN max_file_size_bytes SET DEFAULT 2147483648,
  ALTER COLUMN max_file_size_bytes SET NOT NULL;

INSERT INTO public.subscription_plans (
  id, name, monthly_limit_bytes, label_limit, monthly_video_limit, label_video_limit,
  max_video_duration_seconds, max_file_size_bytes, price_monthly, max_social_accounts, features
)
VALUES
  (
    'basico', 'Básico', 5368709120, '5 GB', 30, '30 vídeos/mês',
    1800, 2147483648, 29.90, 1,
    '["1 conta social conectada", "5 GB de armazenamento total", "Vídeos de até 30 minutos", "Até 30 vídeos/mês", "Corte automático inteligente", "Agendamento de publicações"]'::jsonb
  ),
  (
    'pro', 'Pro', 53687091200, '50 GB', 150, '150 vídeos/mês',
    7200, 10737418240, 59.90, 3,
    '["Até 3 contas sociais conectadas", "50 GB de armazenamento total", "Vídeos longos de até 2 horas", "Arquivos de até 10 GB por vídeo", "Até 150 vídeos/mês", "Corte automático prioritário", "Agendamento multicanal simultâneo"]'::jsonb
  ),
  (
    'premium', 'Premium', 214748364800, '200 GB', 500, 'Vídeos ilimitados (500/mês)',
    14400, 26843545600, 99.90, 3,
    '["Até 3 contas sociais conectadas", "200 GB de armazenamento total", "Vídeos de até 4 horas", "Arquivos de até 25 GB por vídeo", "Vídeos ilimitados (até 500/mês)", "Processamento de corte ultra-rápido", "Agendamento prioritário com retry"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 2. TABELA DE USUÁRIOS E ASSINATURA (users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(190) UNIQUE NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  plan_id VARCHAR(32) NOT NULL DEFAULT 'basico' REFERENCES public.subscription_plans(id),
  subscription_status VARCHAR(32) NOT NULL DEFAULT 'ativa',
  renews_at TIMESTAMPTZ,
  last_payment_id VARCHAR(128),
  payment_method VARCHAR(32),
  billing_interval VARCHAR(32) DEFAULT 'mensal',
  r2_used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32),
  ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(32) DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS r2_used_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan_id ON public.users(plan_id);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_prevent_client_plan_mutation ON public.users;
CREATE TRIGGER trg_users_prevent_client_plan_mutation
  BEFORE INSERT OR UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_client_plan_mutation();

-- ============================================================================
-- 3. TABELA DE VÍDEOS E CORTES (videos)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.videos (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_video_id VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_metadata JSONB,
  thumbnail TEXT NOT NULL DEFAULT '',
  video_url TEXT,
  storage_path TEXT,
  storage_key TEXT,
  preview_key TEXT,
  thumb_key TEXT,
  storage_provider VARCHAR(64) NOT NULL DEFAULT 'r2',
  aspect_ratio VARCHAR(16) DEFAULT '9:16',
  file_size VARCHAR(32) NOT NULL DEFAULT '0 MB',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration VARCHAR(32) NOT NULL DEFAULT '0:00',
  duration_seconds INT NOT NULL DEFAULT 0,
  views_total BIGINT NOT NULL DEFAULT 0,
  published_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'disponivel',
  uploaded_at VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Se a tabela videos já existia sem storage_provider, adiciona como 'supabase'
-- (ou mantém valores existentes) para não classificar vídeos antigos como 'r2'.
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS parent_video_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS preview_key TEXT,
  ADD COLUMN IF NOT EXISTS thumb_key TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(64) NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(16) DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- FK condicional para parent_video_id (NOT VALID preserva registros órfãos legados)
DO $$
DECLARE
  v_id_type TEXT;
  v_id_len INT;
  v_parent_type TEXT;
  v_parent_len INT;
BEGIN
  SELECT data_type, character_maximum_length INTO v_id_type, v_id_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'id';

  SELECT data_type, character_maximum_length INTO v_parent_type, v_parent_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'parent_video_id';

  IF v_id_type = v_parent_type
     AND COALESCE(v_id_len, -1) = COALESCE(v_parent_len, -1)
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'videos'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'parent_video_id'
     ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT fk_videos_parent_video
      FOREIGN KEY (parent_video_id) REFERENCES public.videos(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_parent_id ON public.videos(parent_video_id);
CREATE INDEX IF NOT EXISTS idx_videos_storage_provider ON public.videos(storage_provider);

DROP TRIGGER IF EXISTS trg_videos_updated_at ON public.videos;
CREATE TRIGGER trg_videos_updated_at
  BEFORE UPDATE ON public.videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 4. TABELA DE AGENDAMENTOS MULTICANAL (scheduled_publications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scheduled_publications (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id VARCHAR(64),
  video_url TEXT,
  storage_path TEXT,
  storage_provider VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  call_to_action TEXT DEFAULT '',
  ai_metadata JSONB,
  thumbnail TEXT NOT NULL DEFAULT '',
  duration VARCHAR(32) NOT NULL DEFAULT '0:00',
  scheduled_time VARCHAR(16) NOT NULL,
  scheduled_date_label VARCHAR(64) NOT NULL,
  date_iso DATE NOT NULL,
  platforms JSONB NOT NULL DEFAULT '["tiktok"]'::jsonb,
  status VARCHAR(32) NOT NULL DEFAULT 'agendado',
  aspect_ratio VARCHAR(16) NOT NULL DEFAULT '9:16',
  file_size VARCHAR(32) DEFAULT '',
  error_message TEXT,
  platform_results JSONB,
  published_at TIMESTAMPTZ,
  push_notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.scheduled_publications
  ADD COLUMN IF NOT EXISTS video_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(64),
  ADD COLUMN IF NOT EXISTS hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS call_to_action TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB,
  ADD COLUMN IF NOT EXISTS platform_results JSONB,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_notified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
DECLARE
  v_videos_id_type TEXT;
  v_videos_id_len INT;
  v_sched_vid_type TEXT;
  v_sched_vid_len INT;
BEGIN
  SELECT data_type, character_maximum_length INTO v_videos_id_type, v_videos_id_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'id';

  SELECT data_type, character_maximum_length INTO v_sched_vid_type, v_sched_vid_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scheduled_publications' AND column_name = 'video_id';

  IF v_videos_id_type = v_sched_vid_type
     AND COALESCE(v_videos_id_len, -1) = COALESCE(v_sched_vid_len, -1)
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'scheduled_publications'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'video_id'
     ) THEN
    ALTER TABLE public.scheduled_publications
      ADD CONSTRAINT fk_scheduled_publications_video
      FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON public.scheduled_publications(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_video_id ON public.scheduled_publications(video_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date_iso ON public.scheduled_publications(date_iso);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON public.scheduled_publications(status);
CREATE INDEX IF NOT EXISTS idx_schedules_due_lookup ON public.scheduled_publications(status, date_iso, scheduled_time);

DROP TRIGGER IF EXISTS trg_scheduled_publications_updated_at ON public.scheduled_publications;
CREATE TRIGGER trg_scheduled_publications_updated_at
  BEFORE UPDATE ON public.scheduled_publications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 5. TABELA DE CONFIGURAÇÕES E PREFERÊNCIAS (user_settings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL DEFAULT '',
  email VARCHAR(190) NOT NULL DEFAULT '',
  avatar_url TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  role VARCHAR(80) NOT NULL DEFAULT 'Creator',
  publish_success_notification BOOLEAN NOT NULL DEFAULT TRUE,
  publish_failure_notification BOOLEAN NOT NULL DEFAULT TRUE,
  storage_alert_notification BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
  default_cut_duration_seconds INT NOT NULL DEFAULT 60,
  auto_generate_titles BOOLEAN NOT NULL DEFAULT TRUE,
  selected_theme VARCHAR(64) NOT NULL DEFAULT 'clipo-original',
  theme_mode VARCHAR(16) NOT NULL DEFAULT 'dark',
  custom_colors JSONB,
  language VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS role VARCHAR(80) NOT NULL DEFAULT 'Creator',
  ADD COLUMN IF NOT EXISTS selected_theme VARCHAR(64) NOT NULL DEFAULT 'clipo-original',
  ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(16) NOT NULL DEFAULT 'dark',
  ADD COLUMN IF NOT EXISTS custom_colors JSONB,
  ADD COLUMN IF NOT EXISTS language VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 6. CONEXÕES SOCIAIS E TOKENS OAUTH CRIPTOGRAFADOS (social_connections)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(32) NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'linkedin')),
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  account_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  encrypted_access_token TEXT,
  access_token_iv VARCHAR(64),
  access_token_tag VARCHAR(64),
  encrypted_refresh_token TEXT,
  refresh_token_iv VARCHAR(64),
  refresh_token_tag VARCHAR(64),
  key_version VARCHAR(16) NOT NULL DEFAULT 'v1',
  token_expires_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_social_connections_user_platform UNIQUE (user_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_social_connections_user_id ON public.social_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_social_connections_expires_at ON public.social_connections(token_expires_at);

DROP TRIGGER IF EXISTS trg_social_connections_updated_at ON public.social_connections;
CREATE TRIGGER trg_social_connections_updated_at
  BEFORE UPDATE ON public.social_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 7. SUBSCRIÇÕES WEB PUSH (push_subscriptions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  notify_on_success BOOLEAN NOT NULL DEFAULT TRUE,
  notify_on_failure BOOLEAN NOT NULL DEFAULT TRUE,
  user_agent TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_push_subscriptions_user_endpoint UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);

DROP TRIGGER IF EXISTS trg_push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER trg_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 8. HISTÓRICO DE NOTIFICAÇÕES (notifications)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id VARCHAR(64) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL CHECK (type IN ('publish_success', 'publish_failure', 'push_test', 'system')),
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  publication_id VARCHAR(64),
  platforms JSONB NOT NULL DEFAULT '[]'::jsonb,
  platform_results JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  v_pub_id_type TEXT;
  v_pub_id_len INT;
  v_notif_pub_type TEXT;
  v_notif_pub_len INT;
BEGIN
  SELECT data_type, character_maximum_length INTO v_pub_id_type, v_pub_id_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scheduled_publications' AND column_name = 'id';

  SELECT data_type, character_maximum_length INTO v_notif_pub_type, v_notif_pub_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'publication_id';

  IF v_pub_id_type = v_notif_pub_type
     AND COALESCE(v_pub_id_len, -1) = COALESCE(v_notif_pub_len, -1)
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'notifications'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'publication_id'
     ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT fk_notifications_publication
      FOREIGN KEY (publication_id) REFERENCES public.scheduled_publications(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- ============================================================================
-- 9. EVENTOS DE PAGAMENTO E WEBHOOKS IDEMPOTENTES (payment_events)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id VARCHAR(128) NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(190) NOT NULL DEFAULT '',
  provider VARCHAR(32) NOT NULL DEFAULT 'cakto',
  event VARCHAR(64) NOT NULL,
  plan_id VARCHAR(32) REFERENCES public.subscription_plans(id),
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency VARCHAR(8) NOT NULL DEFAULT 'BRL',
  status VARCHAR(32) NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_user_id ON public.payment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_user_email ON public.payment_events(user_email);
CREATE INDEX IF NOT EXISTS idx_payment_events_created_at ON public.payment_events(created_at DESC);

-- ============================================================================
-- 10. CONTROLE DE UPLOADS MULTIPART R2 (uploads_multipart)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.uploads_multipart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  upload_id TEXT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(128) NOT NULL DEFAULT 'video/mp4',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'uploading' CHECK (status IN ('uploading', 'completed', 'aborted', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_uploads_multipart_key_upload UNIQUE (r2_key, upload_id)
);

CREATE INDEX IF NOT EXISTS idx_uploads_multipart_user_status ON public.uploads_multipart(user_id, status);
CREATE INDEX IF NOT EXISTS idx_uploads_multipart_stale ON public.uploads_multipart(status, created_at);

DROP TRIGGER IF EXISTS trg_uploads_multipart_updated_at ON public.uploads_multipart;
CREATE TRIGGER trg_uploads_multipart_updated_at
  BEFORE UPDATE ON public.uploads_multipart
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 11. FILA PERSISTENTE DE JOBS DE VÍDEO (video_jobs)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.video_jobs (
  id VARCHAR(96) PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id VARCHAR(64),
  job_type VARCHAR(32) NOT NULL DEFAULT 'split' CHECK (job_type IN ('split', 'auto_cut', 'subtitle', 'transcode')),
  status VARCHAR(32) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  current_part INT NOT NULL DEFAULT 0,
  total_parts INT NOT NULL DEFAULT 0,
  message TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error_message TEXT,
  cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
  attempts INT NOT NULL DEFAULT 0,
  worker_id VARCHAR(128),
  lease_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
  v_vid_id_type TEXT;
  v_vid_id_len INT;
  v_job_vid_type TEXT;
  v_job_vid_len INT;
BEGIN
  SELECT data_type, character_maximum_length INTO v_vid_id_type, v_vid_id_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'id';

  SELECT data_type, character_maximum_length INTO v_job_vid_type, v_job_vid_len
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'video_jobs' AND column_name = 'video_id';

  IF v_vid_id_type = v_job_vid_type
     AND COALESCE(v_vid_id_len, -1) = COALESCE(v_job_vid_len, -1)
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'video_jobs'
         AND tc.constraint_type = 'FOREIGN KEY'
         AND kcu.column_name = 'video_id'
     ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT fk_video_jobs_video
      FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_status ON public.video_jobs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_jobs_worker_lease ON public.video_jobs(status, lease_expires_at);

DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_updated_at
  BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 12. SINCRONIZAÇÃO SEGURA COM auth.users (INSERT, UPDATE DE EMAIL E BACKFILL)
--     Usa EXECUTE dinâmico para compatibilidade total entre UUID e VARCHAR(64),
--     sem falha de compilação PL/pgSQL e sem sobrescrever planos existentes.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.sync_auth_user_to_public(
  p_user_id UUID,
  p_email TEXT,
  p_meta JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_users_id_type TEXT;
  v_settings_uid_type TEXT;
  v_name TEXT;
  v_avatar TEXT;
  v_email TEXT;
  v_conflict_id TEXT;
BEGIN
  v_email := COALESCE(NULLIF(BTRIM(p_email), ''), CONCAT(p_user_id::text, '@users.clipo.local'));
  v_name := COALESCE(
    NULLIF(p_meta->>'full_name', ''),
    NULLIF(p_meta->>'name', ''),
    split_part(v_email, '@', 1),
    'Criador Clipo'
  );
  v_avatar := COALESCE(
    NULLIF(p_meta->>'avatar_url', ''),
    NULLIF(p_meta->>'picture', ''),
    ''
  );

  SELECT data_type INTO v_users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  IF v_users_id_type IS NOT NULL THEN
    -- Verifica se já existe registro em public.users com este email sob outro ID legado
    EXECUTE 'SELECT id::text FROM public.users WHERE lower(email) = lower($1) AND id::text <> $2 LIMIT 1'
      INTO v_conflict_id
      USING v_email, p_user_id::text;

    IF v_conflict_id IS NULL THEN
      IF v_users_id_type = 'uuid' THEN
        EXECUTE 'INSERT INTO public.users (id, name, email, avatar_url, plan_id)
                 VALUES ($1, $2, $3, $4, ''basico'')
                 ON CONFLICT (id) DO UPDATE SET
                   email = EXCLUDED.email,
                   name = CASE WHEN COALESCE(public.users.name, '''') = '''' THEN EXCLUDED.name ELSE public.users.name END,
                   avatar_url = CASE WHEN COALESCE(public.users.avatar_url, '''') = '''' THEN EXCLUDED.avatar_url ELSE public.users.avatar_url END'
          USING p_user_id, v_name, v_email, v_avatar;
      ELSE
        EXECUTE 'INSERT INTO public.users (id, name, email, avatar_url, plan_id)
                 VALUES ($1, $2, $3, $4, ''basico'')
                 ON CONFLICT (id) DO UPDATE SET
                   email = EXCLUDED.email,
                   name = CASE WHEN COALESCE(public.users.name, '''') = '''' THEN EXCLUDED.name ELSE public.users.name END,
                   avatar_url = CASE WHEN COALESCE(public.users.avatar_url, '''') = '''' THEN EXCLUDED.avatar_url ELSE public.users.avatar_url END'
          USING p_user_id::text, v_name, v_email, v_avatar;
      END IF;
    ELSE
      RAISE WARNING 'sync_auth_user_to_public: email % já pertence ao ID legado % (auth UUID % aguardando reconciliação manual).',
        v_email, v_conflict_id, p_user_id;
    END IF;
  END IF;

  SELECT data_type INTO v_settings_uid_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'user_id';

  IF v_settings_uid_type IS NOT NULL THEN
    IF v_settings_uid_type = 'uuid' THEN
      EXECUTE 'INSERT INTO public.user_settings (user_id, name, email, avatar_url)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id) DO UPDATE SET
                 email = EXCLUDED.email'
        USING p_user_id, v_name, v_email, v_avatar;
    ELSE
      EXECUTE 'INSERT INTO public.user_settings (user_id, name, email, avatar_url)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id) DO UPDATE SET
                 email = EXCLUDED.email'
        USING p_user_id::text, v_name, v_email, v_avatar;
    END IF;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'sync_auth_user_to_public erro não-bloqueante para %: %', p_user_id, SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_auth_user_to_public(NEW.id, NEW.email, NEW.raw_user_meta_data);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_auth_user_to_public(UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email OR OLD.raw_user_meta_data IS DISTINCT FROM NEW.raw_user_meta_data)
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Backfill seguro e não-destrutivo de usuários já existentes em auth.users
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, email, raw_user_meta_data FROM auth.users
  LOOP
    PERFORM public.sync_auth_user_to_public(r.id, r.email, r.raw_user_meta_data);
  END LOOP;
END $$;

-- ============================================================================
-- 13. LIMPEZA DE POLÍTICAS RLS ANTIGAS + APLICAÇÃO DE RLS ESTRITA E GRANTS
-- ============================================================================

-- Remove QUALQUER política RLS pré-existente nas 11 tabelas gerenciadas
-- para impedir que políticas antigas permissivas continuem válidas via OR.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'subscription_plans',
        'users',
        'videos',
        'scheduled_publications',
        'user_settings',
        'social_connections',
        'push_subscriptions',
        'notifications',
        'payment_events',
        'uploads_multipart',
        'video_jobs'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Habilita RLS em todas as 11 tabelas
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads_multipart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_jobs ENABLE ROW LEVEL SECURITY;

-- Garante privilégios completos de backend/admin para service_role em todas as 11 tabelas e sequências
GRANT ALL ON public.subscription_plans TO service_role;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.videos TO service_role;
GRANT ALL ON public.scheduled_publications TO service_role;
GRANT ALL ON public.user_settings TO service_role;
GRANT ALL ON public.social_connections TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.notifications TO service_role;
GRANT ALL ON public.payment_events TO service_role;
GRANT ALL ON public.uploads_multipart TO service_role;
GRANT ALL ON public.video_jobs TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ----------------------------------------------------------------------------
-- 13.1 subscription_plans (somente SELECT para anon/authenticated)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.subscription_plans FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;

CREATE POLICY "Public read subscription plans" ON public.subscription_plans
  FOR SELECT
  USING (true);

-- ----------------------------------------------------------------------------
-- 13.2 users (SELECT próprio; UPDATE estrito apenas em name e avatar_url)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.users FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (name, avatar_url) ON public.users TO authenticated;

DO $$
DECLARE
  v_users_id_type TEXT;
  v_expr TEXT;
BEGIN
  SELECT data_type INTO v_users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  v_expr := CASE
    WHEN v_users_id_type = 'uuid' THEN '(SELECT auth.uid()) = id'
    ELSE '(SELECT auth.uid())::text = id::text'
  END;

  EXECUTE format(
    'CREATE POLICY "Users can read own profile" ON public.users FOR SELECT TO authenticated USING (%s)',
    v_expr
  );
  EXECUTE format(
    'CREATE POLICY "Users can update own safe profile fields" ON public.users FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
    v_expr, v_expr
  );
END $$;

-- ----------------------------------------------------------------------------
-- 13.3 videos (CRUD isolado por usuário; USING + WITH CHECK adaptativo ao tipo)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.videos FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.videos TO authenticated;

DO $$
DECLARE
  v_col_type TEXT;
  v_expr TEXT;
BEGIN
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'user_id';

  v_expr := CASE
    WHEN v_col_type = 'uuid' THEN '(SELECT auth.uid()) = user_id'
    ELSE '(SELECT auth.uid())::text = user_id::text'
  END;

  EXECUTE format('CREATE POLICY "Users can only read own videos" ON public.videos FOR SELECT TO authenticated USING (%s)', v_expr);
  EXECUTE format('CREATE POLICY "Users can only insert own videos" ON public.videos FOR INSERT TO authenticated WITH CHECK (%s)', v_expr);
  EXECUTE format('CREATE POLICY "Users can only update own videos" ON public.videos FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_expr, v_expr);
  EXECUTE format('CREATE POLICY "Users can only delete own videos" ON public.videos FOR DELETE TO authenticated USING (%s)', v_expr);
END $$;

-- ----------------------------------------------------------------------------
-- 13.4 scheduled_publications (CRUD isolado por usuário; USING + WITH CHECK)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.scheduled_publications FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_publications TO authenticated;

DO $$
DECLARE
  v_col_type TEXT;
  v_expr TEXT;
BEGIN
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scheduled_publications' AND column_name = 'user_id';

  v_expr := CASE
    WHEN v_col_type = 'uuid' THEN '(SELECT auth.uid()) = user_id'
    ELSE '(SELECT auth.uid())::text = user_id::text'
  END;

  EXECUTE format('CREATE POLICY "Users can only read own schedules" ON public.scheduled_publications FOR SELECT TO authenticated USING (%s)', v_expr);
  EXECUTE format('CREATE POLICY "Users can only insert own schedules" ON public.scheduled_publications FOR INSERT TO authenticated WITH CHECK (%s)', v_expr);
  EXECUTE format('CREATE POLICY "Users can only update own schedules" ON public.scheduled_publications FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_expr, v_expr);
  EXECUTE format('CREATE POLICY "Users can only delete own schedules" ON public.scheduled_publications FOR DELETE TO authenticated USING (%s)', v_expr);
END $$;

-- ----------------------------------------------------------------------------
-- 13.5 user_settings (CRUD isolado; impede alteração de plan_name pelo cliente se coluna existir)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.user_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;

DO $$
DECLARE
  v_col_type TEXT;
  v_expr TEXT;
  v_has_plan_name BOOLEAN;
BEGIN
  SELECT data_type INTO v_col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'user_id';

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'plan_name'
  ) INTO v_has_plan_name;

  IF v_has_plan_name THEN
    REVOKE UPDATE (plan_name) ON public.user_settings FROM authenticated;
  END IF;

  v_expr := CASE
    WHEN v_col_type = 'uuid' THEN '(SELECT auth.uid()) = user_id'
    ELSE '(SELECT auth.uid())::text = user_id::text'
  END;

  EXECUTE format('CREATE POLICY "Users can read own settings" ON public.user_settings FOR SELECT TO authenticated USING (%s)', v_expr);
  EXECUTE format('CREATE POLICY "Users can insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (%s)', v_expr);
  EXECUTE format('CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_expr, v_expr);
  EXECUTE format('CREATE POLICY "Users can delete own settings" ON public.user_settings FOR DELETE TO authenticated USING (%s)', v_expr);
END $$;

-- ----------------------------------------------------------------------------
-- 13.6 social_connections e payment_events — ISOLAMENTO ESTRITO (service_role only)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.social_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.payment_events FROM PUBLIC, anon, authenticated;

CREATE POLICY "Deny all client access to social_connections" ON public.social_connections
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE POLICY "Deny all client access to payment_events" ON public.payment_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- 13.7 push_subscriptions (USING + WITH CHECK)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.push_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;

CREATE POLICY "Users can read own push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 13.8 notifications (SELECT e UPDATE apenas em read_at; INSERT/DELETE só backend)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.notifications FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE (read_at) ON public.notifications TO authenticated;

CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 13.9 uploads_multipart e video_jobs (somente SELECT para usuário; mutações via backend)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.uploads_multipart FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.uploads_multipart TO authenticated;

CREATE POLICY "Users can read own multipart uploads" ON public.uploads_multipart
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.video_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.video_jobs TO authenticated;

CREATE POLICY "Users can read own video jobs" ON public.video_jobs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- 14. BUCKET PRIVADO 'clipo-videos' E POLÍTICAS DE STORAGE LIMPAS
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clipo-videos',
  'clipo-videos',
  false,
  10737418240, -- 10 GB (arquivos até 25 GB irão para o Cloudflare R2 na Etapa 2)
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Remove políticas antigas específicas do bucket 'clipo-videos' sem tocar em outros buckets
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%clipo-videos%'
        OR COALESCE(with_check, '') ILIKE '%clipo-videos%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "clipo_videos_insert_own_folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "clipo_videos_select_own_folder"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "clipo_videos_update_own_folder"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

CREATE POLICY "clipo_videos_delete_own_folder"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

COMMIT;
