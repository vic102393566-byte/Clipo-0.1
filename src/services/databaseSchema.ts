/**
 * ==============================================================================================
 * CLIPO - ESTRUTURA DE DADOS REAL E CONTRATO DE BANCO DE DADOS (DATABASE SCHEMA SPECIFICATION)
 * ==============================================================================================
 * 
 * Este arquivo define a arquitetura relacional de dados para conexão com qualquer backend real
 * (PostgreSQL, Supabase, Firebase Firestore, Neon, Prisma ou TypeORM/Drizzle).
 *
 * ENTIDADES MAPEADAS:
 * 1. users                  -> Usuários cadastrados, credenciais e plano vinculado
 * 2. videos                 -> Vídeos enviados, decupados e gerados
 * 3. scheduled_publications -> Agendamentos multicanal com datas e status de publicação
 * 4. user_settings          -> Configurações de perfil e preferências do usuário
 * 5. subscription_plans     -> Tabela de planos e cotas (Básico, Pro, Premium)
 *
 * POLÍTICA DE SEGURANÇA MULTI-TENANT (ROW LEVEL SECURITY - RLS):
 * Cada usuário autenticado possui isolamento estrito via `user_id`, garantindo que ninguém acesse
 * vídeos, agendamentos ou configurações de outras contas.
 * ==============================================================================================
 */

export const POSTGRES_DDL_SCHEMA = `
-- Habilita extensão para geração de UUID v4 caso não exista
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -------------------------------------------------------------
-- 1. TABELA DE PLANOS DE ASSINATURA (subscription_plans)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(32) PRIMARY KEY, -- 'basico', 'pro', 'premium'
  name VARCHAR(64) NOT NULL,
  monthly_limit_bytes BIGINT NOT NULL, -- Ex: 5368709120 (5GB), 53687091200 (50GB), 214748364800 (200GB)
  label_limit VARCHAR(32) NOT NULL, -- '5 GB', '50 GB', '200 GB'
  monthly_video_limit INT NOT NULL, -- 30, 150, 500
  label_video_limit VARCHAR(64) NOT NULL,
  price_monthly NUMERIC(10, 2) NOT NULL, -- 29.90, 59.90, 99.90
  max_social_accounts INT NOT NULL DEFAULT 1,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed inicial de planos
INSERT INTO subscription_plans (id, name, monthly_limit_bytes, label_limit, monthly_video_limit, label_video_limit, price_monthly, max_social_accounts, features)
VALUES 
  ('basico', 'Básico', 5368709120, '5 GB', 30, '30 vídeos/mês', 29.90, 1, '["1 conta social conectada", "5 GB de armazenamento", "Até 30 vídeos/mês", "Corte automático inteligente", "Agendamento de publicações"]'::jsonb),
  ('pro', 'Pro', 53687091200, '50 GB', 150, '150 vídeos/mês', 59.90, 3, '["Até 3 contas sociais conectadas", "50 GB de armazenamento", "Até 150 vídeos/mês", "Corte automático prioritário", "Agendamento multicanal simultâneo"]'::jsonb),
  ('premium', 'Premium', 214748364800, '200 GB', 500, 'Vídeos ilimitados (500/mês)', 99.90, 3, '["Até 3 contas sociais conectadas", "200 GB de armazenamento", "Vídeos ilimitados (até 500/mês)", "Processamento ultra-rápido", "Agendamento prioritário com retry"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- -------------------------------------------------------------
-- 2. TABELA DE USUÁRIOS (users)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY, -- Ex: 'usr_xyz123' ou auth.uid()
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) UNIQUE NOT NULL,
  avatar_url TEXT DEFAULT '',
  plan_id VARCHAR(32) NOT NULL DEFAULT 'pro' REFERENCES subscription_plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- -------------------------------------------------------------
-- 3. TABELA DE VÍDEOS (videos)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR(64) PRIMARY KEY, -- Ex: 'vid-123456789'
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  thumbnail TEXT NOT NULL,
  video_url TEXT,
  storage_path TEXT, -- Caminho do bucket S3 / Cloud Storage / Supabase Storage
  file_size VARCHAR(32) NOT NULL DEFAULT '0 MB',
  size_bytes BIGINT NOT NULL DEFAULT 0,
  duration VARCHAR(32) NOT NULL DEFAULT '0:00',
  duration_seconds INT DEFAULT 0,
  views_total BIGINT NOT NULL DEFAULT 0,
  published_count INT NOT NULL DEFAULT 0,
  status VARCHAR(32) NOT NULL DEFAULT 'disponivel', -- 'disponivel', 'processando', 'em_agendamento', 'publicado', 'erro'
  uploaded_at VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  storage_provider VARCHAR(64) DEFAULT 'Clipo Storage Engine'
);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);

-- -------------------------------------------------------------
-- 4. TABELA DE AGENDAMENTOS (scheduled_publications)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_publications (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id VARCHAR(64) REFERENCES videos(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  thumbnail TEXT NOT NULL,
  duration VARCHAR(32) NOT NULL,
  scheduled_time VARCHAR(16) NOT NULL, -- '18:30'
  scheduled_date_label VARCHAR(64) NOT NULL, -- 'Hoje, 23 Set'
  date_iso DATE NOT NULL, -- '2026-09-23'
  platforms JSONB NOT NULL DEFAULT '["tiktok"]'::jsonb, -- ['tiktok', 'instagram', 'youtube', 'linkedin']
  status VARCHAR(32) NOT NULL DEFAULT 'agendado', -- 'agendado', 'processando', 'publicado', 'falhou', 'cancelado'
  aspect_ratio VARCHAR(16) NOT NULL DEFAULT '9:16', -- '9:16', '16:9', '1:1'
  file_size VARCHAR(32) DEFAULT '',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON scheduled_publications(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date_iso ON scheduled_publications(date_iso);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON scheduled_publications(status);

-- -------------------------------------------------------------
-- 5. TABELA DE CONFIGURAÇÕES E PREFERÊNCIAS (user_settings)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  avatar_url TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  publish_success_notification BOOLEAN NOT NULL DEFAULT TRUE,
  publish_failure_notification BOOLEAN NOT NULL DEFAULT TRUE,
  storage_alert_notification BOOLEAN NOT NULL DEFAULT TRUE,
  marketing_emails BOOLEAN NOT NULL DEFAULT FALSE,
  default_cut_duration_seconds INT NOT NULL DEFAULT 60,
  auto_generate_titles BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -------------------------------------------------------------
-- 6. POLÍTICAS DE ROW LEVEL SECURITY (RLS) - SEGURANÇA TOTAL
-- -------------------------------------------------------------
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Usuário só tem acesso aos seus próprios vídeos:
CREATE POLICY "Users can only read own videos" ON videos
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only insert own videos" ON videos
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can only update own videos" ON videos
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only delete own videos" ON videos
  FOR DELETE USING (auth.uid()::text = user_id);

-- Usuário só tem acesso aos seus próprios agendamentos:
CREATE POLICY "Users can only read own schedules" ON scheduled_publications
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only insert own schedules" ON scheduled_publications
  FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Users can only update own schedules" ON scheduled_publications
  FOR UPDATE USING (auth.uid()::text = user_id);

CREATE POLICY "Users can only delete own schedules" ON scheduled_publications
  FOR DELETE USING (auth.uid()::text = user_id);

-- Usuário só tem acesso às suas próprias configurações:
CREATE POLICY "Users can only access own settings" ON user_settings
  FOR ALL USING (auth.uid()::text = user_id);
`;

/**
 * ==============================================================================================
 * GUIA DE INTEGRAÇÃO COM BACKEND REST / FETCH API
 * ==============================================================================================
 * Abaixo estão os endpoints esperados do backend quando uma API real for conectada:
 */
export const API_ENDPOINTS_SPEC = {
  auth: {
    login: 'POST /api/auth/login',
    register: 'POST /api/auth/register',
    logout: 'POST /api/auth/logout',
    me: 'GET /api/auth/me',
  },
  users: {
    getProfile: 'GET /api/users/profile',
    updateProfile: 'PUT /api/users/profile',
    updatePlan: 'PATCH /api/users/plan',
  },
  videos: {
    list: 'GET /api/videos',
    upload: 'POST /api/videos/upload',
    split: 'POST /api/videos/:id/split',
    getById: 'GET /api/videos/:id',
    delete: 'DELETE /api/videos/:id',
  },
  schedules: {
    list: 'GET /api/schedules',
    create: 'POST /api/schedules',
    update: 'PUT /api/schedules/:id',
    delete: 'DELETE /api/schedules/:id',
  },
  settings: {
    get: 'GET /api/settings',
    save: 'PUT /api/settings',
  },
  plans: {
    list: 'GET /api/plans',
  },
};
