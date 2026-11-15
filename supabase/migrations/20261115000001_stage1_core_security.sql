-- ============================================================================
-- CLIPO — MIGRAÇÃO SQL VERSIONADA (ETAPA 1: CORE, PERSISTÊNCIA, RLS E SEGURANÇA)
-- Arquivo: supabase/migrations/20261115000001_stage1_core_security.sql
--
-- OBJETIVOS:
-- 1. Consolidar tabelas base (subscription_plans, users, videos,
--    scheduled_publications, user_settings) de forma não-destrutiva.
-- 2. Criar novas tabelas para eliminar JSONs locais e Maps em memória
--    (social_connections, push_subscriptions, notifications, payment_events,
--    uploads_multipart, video_jobs).
-- 3. Aplicar chaves estrangeiras, índices e triggers de integridade/auditoria.
-- 4. Configurar RLS estrita (USING + WITH CHECK), isolando social_connections
--    e payment_events exclusivamente para o backend (service_role).
-- 5. Garantir compatibilidade com auth.users e impedir alteração de planos
--    diretamente pelo cliente autenticado.
-- 6. Preservar o bucket privado 'clipo-videos' no Supabase Storage durante
--    a transição híbrida para o Cloudflare R2.
--
-- NOTA: Revise as observações de conflitos potenciais antes de executar no
-- Supabase SQL Editor. Este script é idempotente e não apaga dados existentes.
-- ============================================================================

BEGIN;

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- FUNÇÕES UTILITÁRIAS E TRIGGERS GERAIS
-- ============================================================================

-- Atualiza automaticamente a coluna updated_at em qualquer UPDATE
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Impede que usuários autenticados (role 'authenticated' / 'anon') alterem
-- colunas sensíveis de plano, assinatura ou cota diretamente via PostgREST.
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
  -- Permite alterações feitas pelo backend (service_role) ou admin SQL (postgres/supabase_admin)
  IF v_jwt_role = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'supabase_auth_admin') THEN
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

-- ============================================================================
-- 1. TABELA DE PLANOS DE ASSINATURA (subscription_plans)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id VARCHAR(32) PRIMARY KEY, -- 'basico', 'pro', 'premium'
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

-- Caso a tabela já exista (DDL anterior sem duração/tamanho máximo por arquivo)
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_video_duration_seconds INT NOT NULL DEFAULT 1800,
  ADD COLUMN IF NOT EXISTS max_file_size_bytes BIGINT NOT NULL DEFAULT 2147483648,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Seed inicial idempotente (não sobrescreve customizações existentes, apenas garante os 3 planos)
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

-- Preenche limites nos registros pré-existentes caso ainda estejam com o default de 30m/2GB
UPDATE public.subscription_plans SET max_video_duration_seconds = 7200, max_file_size_bytes = 10737418240
WHERE id = 'pro' AND (max_video_duration_seconds = 1800 OR max_file_size_bytes = 2147483648);

UPDATE public.subscription_plans SET max_video_duration_seconds = 14400, max_file_size_bytes = 26843545600
WHERE id = 'premium' AND (max_video_duration_seconds = 1800 OR max_file_size_bytes = 2147483648);

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
  subscription_status VARCHAR(32) NOT NULL DEFAULT 'ativa', -- 'ativa', 'pendente', 'cancelada', 'expirada'
  renews_at TIMESTAMPTZ,
  last_payment_id VARCHAR(128),
  payment_method VARCHAR(32),
  billing_interval VARCHAR(32) DEFAULT 'mensal',
  r2_used_bytes BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evolução não-destrutiva caso a tabela users já exista
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(32) NOT NULL DEFAULT 'ativa',
  ADD COLUMN IF NOT EXISTS renews_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32),
  ADD COLUMN IF NOT EXISTS billing_interval VARCHAR(32) DEFAULT 'mensal',
  ADD COLUMN IF NOT EXISTS r2_used_bytes BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_plan_id ON public.users(plan_id);

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_users_prevent_client_plan_mutation ON public.users;
CREATE TRIGGER trg_users_prevent_client_plan_mutation
  BEFORE UPDATE ON public.users
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
  storage_provider VARCHAR(32) NOT NULL DEFAULT 'r2', -- 'r2', 'supabase', 'local'
  aspect_ratio VARCHAR(16) DEFAULT '9:16',
  file_size VARCHAR(32) NOT NULL DEFAULT '0 MB',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration VARCHAR(32) NOT NULL DEFAULT '0:00',
  duration_seconds INT NOT NULL DEFAULT 0,
  views_total BIGINT NOT NULL DEFAULT 0,
  published_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'disponivel', -- 'disponivel', 'processando', 'em_agendamento', 'publicado', 'erro'
  uploaded_at VARCHAR(64) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evolução não-destrutiva caso a tabela videos já exista no banco ativo
ALTER TABLE public.videos
  ADD COLUMN IF NOT EXISTS parent_video_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB,
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS preview_key TEXT,
  ADD COLUMN IF NOT EXISTS thumb_key TEXT,
  ADD COLUMN IF NOT EXISTS aspect_ratio VARCHAR(16) DEFAULT '9:16',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Auto-referência para cortes derivados (adicionada apenas se ainda não existir e tipos forem compatíveis)
DO $$
DECLARE
  v_id_type TEXT;
  v_parent_type TEXT;
BEGIN
  SELECT data_type INTO v_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'id';

  SELECT data_type INTO v_parent_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'parent_video_id';

  IF v_id_type = v_parent_type AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_videos_parent_video'
  ) THEN
    ALTER TABLE public.videos
      ADD CONSTRAINT fk_videos_parent_video
      FOREIGN KEY (parent_video_id) REFERENCES public.videos(id) ON DELETE SET NULL;
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
  storage_provider VARCHAR(32),
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
  status VARCHAR(32) NOT NULL DEFAULT 'agendado', -- 'agendado', 'processando', 'publicado', 'falhou', 'cancelado'
  aspect_ratio VARCHAR(16) NOT NULL DEFAULT '9:16',
  file_size VARCHAR(32) DEFAULT '',
  error_message TEXT,
  platform_results JSONB,
  published_at TIMESTAMPTZ,
  push_notified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK condicional para videos(id) apenas se os tipos forem compatíveis no banco ativo
DO $$
DECLARE
  v_videos_id_type TEXT;
  v_sched_vid_type TEXT;
BEGIN
  SELECT data_type INTO v_videos_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'id';

  SELECT data_type INTO v_sched_vid_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scheduled_publications' AND column_name = 'video_id';

  IF v_videos_id_type = v_sched_vid_type AND NOT EXISTS (
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
      FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Evolução não-destrutiva caso a tabela scheduled_publications já exista
ALTER TABLE public.scheduled_publications
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(32),
  ADD COLUMN IF NOT EXISTS hashtags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS call_to_action TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS ai_metadata JSONB,
  ADD COLUMN IF NOT EXISTS platform_results JSONB,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS push_notified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
  plan_name VARCHAR(64) NOT NULL DEFAULT 'Pro',
  publish_success_notification BOOLEAN NOT NULL DEFAULT TRUE,
  publish_failure_notification BOOLEAN NOT NULL DEFAULT TRUE,
  storage_alert_notification BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
  default_cut_duration_seconds INT NOT NULL DEFAULT 60,
  auto_generate_titles BOOLEAN NOT NULL DEFAULT TRUE,
  selected_theme VARCHAR(64) NOT NULL DEFAULT 'clipo-original',
  theme_mode VARCHAR(16) NOT NULL DEFAULT 'dark', -- 'light', 'dark', 'system'
  custom_colors JSONB,
  language VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Evolução não-destrutiva caso user_settings já exista
ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS role VARCHAR(80) NOT NULL DEFAULT 'Creator',
  ADD COLUMN IF NOT EXISTS plan_name VARCHAR(64) NOT NULL DEFAULT 'Pro',
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
--    Substitui /tmp/clipo_storage_secure/social_connections.json
--    Acesso estrito via service_role (nunca exposta diretamente ao frontend).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.social_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform VARCHAR(32) NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'linkedin')),
  connected BOOLEAN NOT NULL DEFAULT FALSE,
  account_meta JSONB NOT NULL DEFAULT '{}'::jsonb, -- handle, name, avatar, openId, scope (sem tokens)
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
--    Substitui /tmp/clipo_storage_secure/push_subscriptions.json
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
--    Substitui /tmp/clipo_storage_secure/notifications_log.json
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

-- FK opcional para scheduled_publications apenas se os tipos de id forem compatíveis
DO $$
DECLARE
  v_pub_id_type TEXT;
BEGIN
  SELECT data_type INTO v_pub_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'scheduled_publications' AND column_name = 'id';

  IF v_pub_id_type = 'character varying' AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_publication'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT fk_notifications_publication
      FOREIGN KEY (publication_id) REFERENCES public.scheduled_publications(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- ============================================================================
-- 9. EVENTOS DE PAGAMENTO E WEBHOOKS IDEMPOTENTES (payment_events)
--    Substitui receivedWebhookEvents / serverSubscriptionState em memória.
--    Acesso estrito via service_role (nunca exposta diretamente ao frontend).
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
--     Base para Etapa 2 (rastreamento de upload direto e abort de órfãos > 24h)
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
--     Substitui activeProcessingJobs (server.ts) e activeJobs (worker)
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
BEGIN
  SELECT data_type INTO v_vid_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'videos' AND column_name = 'id';

  IF v_vid_id_type = 'character varying' AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_video_jobs_video'
  ) THEN
    ALTER TABLE public.video_jobs
      ADD CONSTRAINT fk_video_jobs_video
      FOREIGN KEY (video_id) REFERENCES public.videos(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_video_jobs_user_status ON public.video_jobs(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_jobs_worker_lease ON public.video_jobs(status, lease_expires_at);

DROP TRIGGER IF EXISTS trg_video_jobs_updated_at ON public.video_jobs;
CREATE TRIGGER trg_video_jobs_updated_at
  BEFORE UPDATE ON public.video_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================================
-- 12. SINCRONIZAÇÃO AUTOMÁTICA COM auth.users DO SUPABASE
--     Compatível mesmo se public.users.id / user_settings.user_id já existirem
--     como VARCHAR(64) no banco ativo.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
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
BEGIN
  v_email := COALESCE(NEW.email, CONCAT(NEW.id::text, '@users.clipo.local'));
  v_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    split_part(v_email, '@', 1),
    'Criador Clipo'
  );
  v_avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    ''
  );

  SELECT data_type INTO v_users_id_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id';

  IF v_users_id_type = 'uuid' THEN
    INSERT INTO public.users (id, name, email, avatar_url, plan_id)
    VALUES (NEW.id, v_name, v_email, v_avatar, 'basico')
    ON CONFLICT (id) DO NOTHING;
  ELSIF v_users_id_type IS NOT NULL THEN
    INSERT INTO public.users (id, name, email, avatar_url, plan_id)
    VALUES (NEW.id::text, v_name, v_email, v_avatar, 'basico')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  SELECT data_type INTO v_settings_uid_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'user_settings' AND column_name = 'user_id';

  IF v_settings_uid_type = 'uuid' THEN
    INSERT INTO public.user_settings (user_id, name, email, avatar_url)
    VALUES (NEW.id, v_name, v_email, v_avatar)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF v_settings_uid_type IS NOT NULL THEN
    INSERT INTO public.user_settings (user_id, name, email, avatar_url)
    VALUES (NEW.id::text, v_name, v_email, v_avatar)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Nunca bloqueia o fluxo de cadastro/OAuth no Supabase Auth
    RAISE WARNING 'handle_new_auth_user aviso para %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================================
-- 13. ROW LEVEL SECURITY (RLS) E PRIVILÉGIOS DE COLUNA/TABELA
-- ============================================================================

-- Habilitar RLS em TODAS as tabelas do schema public
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

-- ----------------------------------------------------------------------------
-- 13.1 subscription_plans (leitura liberada; escrita exclusiva service_role)
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.subscription_plans FROM anon, authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;

DROP POLICY IF EXISTS "Public read subscription plans" ON public.subscription_plans;
CREATE POLICY "Public read subscription plans" ON public.subscription_plans
  FOR SELECT
  USING (true);

-- ----------------------------------------------------------------------------
-- 13.2 users (leitura do próprio perfil; UPDATE apenas em name/avatar_url/updated_at)
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.users FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.users FROM authenticated;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (name, avatar_url, updated_at) ON public.users TO authenticated;

DROP POLICY IF EXISTS "Users can read own profile" ON public.users;
CREATE POLICY "Users can read own profile" ON public.users
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid())::text = id::text);

DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.users;
CREATE POLICY "Users can update own safe profile fields" ON public.users
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid())::text = id::text)
  WITH CHECK ((SELECT auth.uid())::text = id::text);

-- ----------------------------------------------------------------------------
-- 13.3 videos (USING + WITH CHECK compatíveis com UUID ou VARCHAR pré-existente)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can only read own videos" ON public.videos;
CREATE POLICY "Users can only read own videos" ON public.videos
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can only insert own videos" ON public.videos;
CREATE POLICY "Users can only insert own videos" ON public.videos
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can only update own videos" ON public.videos;
CREATE POLICY "Users can only update own videos" ON public.videos
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text)
  WITH CHECK ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can only delete own videos" ON public.videos;
CREATE POLICY "Users can only delete own videos" ON public.videos
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text);

-- ----------------------------------------------------------------------------
-- 13.4 scheduled_publications (USING + WITH CHECK)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can only read own schedules" ON public.scheduled_publications;
CREATE POLICY "Users can only read own schedules" ON public.scheduled_publications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can only insert own schedules" ON public.scheduled_publications;
CREATE POLICY "Users can only insert own schedules" ON public.scheduled_publications
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can only update own schedules" ON public.scheduled_publications;
CREATE POLICY "Users can only update own schedules" ON public.scheduled_publications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text)
  WITH CHECK ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can only delete own schedules" ON public.scheduled_publications;
CREATE POLICY "Users can only delete own schedules" ON public.scheduled_publications
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text);

-- ----------------------------------------------------------------------------
-- 13.5 user_settings (USING + WITH CHECK por operação)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can only access own settings" ON public.user_settings;
DROP POLICY IF EXISTS "Users can read own settings" ON public.user_settings;
CREATE POLICY "Users can read own settings" ON public.user_settings
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text)
  WITH CHECK ((SELECT auth.uid())::text = user_id::text);

DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
CREATE POLICY "Users can delete own settings" ON public.user_settings
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid())::text = user_id::text);

-- ----------------------------------------------------------------------------
-- 13.6 social_connections e payment_events — ISOLAMENTO ESTRITO (service_role only)
--      Nenhum cliente anon/authenticated pode consultar ou alterar diretamente.
-- ----------------------------------------------------------------------------
REVOKE ALL ON public.social_connections FROM anon, authenticated;
REVOKE ALL ON public.payment_events FROM anon, authenticated;
GRANT ALL ON public.social_connections TO service_role;
GRANT ALL ON public.payment_events TO service_role;

DROP POLICY IF EXISTS "Deny all client access to social_connections" ON public.social_connections;
CREATE POLICY "Deny all client access to social_connections" ON public.social_connections
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny all client access to payment_events" ON public.payment_events;
CREATE POLICY "Deny all client access to payment_events" ON public.payment_events
  FOR ALL TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- ----------------------------------------------------------------------------
-- 13.7 push_subscriptions (USING + WITH CHECK)
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can read own push subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can update own push subscriptions" ON public.push_subscriptions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 13.8 notifications (leitura e marcação de leitura pelo usuário; inserção pelo backend)
-- ----------------------------------------------------------------------------
REVOKE INSERT, DELETE ON public.notifications FROM anon, authenticated;
GRANT SELECT, UPDATE (read_at) ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

DROP POLICY IF EXISTS "Users can read own notifications" ON public.notifications;
CREATE POLICY "Users can read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can mark own notifications read" ON public.notifications;
CREATE POLICY "Users can mark own notifications read" ON public.notifications
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- 13.9 uploads_multipart e video_jobs (leitura do usuário; mutações críticas pelo backend)
-- ----------------------------------------------------------------------------
REVOKE INSERT, UPDATE, DELETE ON public.uploads_multipart FROM anon, authenticated;
GRANT SELECT ON public.uploads_multipart TO authenticated;
GRANT ALL ON public.uploads_multipart TO service_role;

DROP POLICY IF EXISTS "Users can read own multipart uploads" ON public.uploads_multipart;
CREATE POLICY "Users can read own multipart uploads" ON public.uploads_multipart
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.video_jobs FROM anon, authenticated;
GRANT SELECT ON public.video_jobs TO authenticated;
GRANT ALL ON public.video_jobs TO service_role;

DROP POLICY IF EXISTS "Users can read own video jobs" ON public.video_jobs;
CREATE POLICY "Users can read own video jobs" ON public.video_jobs
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- ============================================================================
-- 14. PRESERVAÇÃO DO BUCKET PRIVADO 'clipo-videos' (SUPABASE STORAGE)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clipo-videos',
  'clipo-videos',
  false,
  10737418240, -- 10 GB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']
)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Permitir upload no bucket clipo-videos apenas na pasta do usuario" ON storage.objects;
CREATE POLICY "Permitir upload no bucket clipo-videos apenas na pasta do usuario"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Permitir leitura no bucket clipo-videos apenas da pasta do usuario" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura no bucket clipo-videos apenas na pasta do usuario" ON storage.objects;
CREATE POLICY "Permitir leitura no bucket clipo-videos apenas na pasta do usuario"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Permitir atualizacao no bucket clipo-videos apenas da pasta do usuario" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualizacao no bucket clipo-videos apenas na pasta do usuario" ON storage.objects;
CREATE POLICY "Permitir atualizacao no bucket clipo-videos apenas na pasta do usuario"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Permitir exclusao no bucket clipo-videos apenas da pasta do usuario" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusao no bucket clipo-videos apenas na pasta do usuario" ON storage.objects;
CREATE POLICY "Permitir exclusao no bucket clipo-videos apenas na pasta do usuario"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'clipo-videos' AND
    (SELECT auth.uid())::text = (storage.foldername(name))[1]
  );

COMMIT;
