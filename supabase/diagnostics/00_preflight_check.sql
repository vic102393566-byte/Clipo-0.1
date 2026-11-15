-- ============================================================================
-- CLIPO — SCRIPT DE DIAGNÓSTICO SOMENTE LEITURA (PRE-FLIGHT CHECK)
-- Arquivo: supabase/diagnostics/00_preflight_check.sql
--
-- FINALIDADE:
-- Executar ANTES da migração Stage 1 v2 no Supabase SQL Editor para inspecionar
-- o schema ativo sem criar, alterar ou apagar nenhum dado.
--
-- SEGURANÇA: Contém APENAS instruções SELECT em catálogos do PostgreSQL,
--            auth.users (contagem) e storage.buckets/objects (metadados).
-- ============================================================================

-- 1. Ambiente, versão do PostgreSQL e papel executor atual
SELECT
  version() AS postgres_version,
  current_user AS executing_role,
  session_user AS session_role,
  current_database() AS database_name;

-- 2. Tabelas existentes no schema 'public' e volume estimado de linhas
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced,
  COALESCE(s.n_live_tup, 0) AS estimated_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
ORDER BY c.relname;

-- 3. Colunas, tipos, nulabilidade e defaults das tabelas-alvo existentes
--    (Identifica divergências VARCHAR vs UUID e colunas NOT NULL inesperadas)
SELECT
  table_name,
  ordinal_position,
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
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
ORDER BY table_name, ordinal_position;

-- 4. Constraints existentes (PRIMARY KEY, UNIQUE, FOREIGN KEY, CHECK)
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
  AND tc.table_schema = ccu.table_schema
WHERE tc.table_schema = 'public'
  AND tc.table_name IN (
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
ORDER BY tc.table_name, tc.constraint_type, tc.constraint_name;

-- 5. Índices existentes no schema 'public'
SELECT
  tablename AS table_name,
  indexname AS index_name,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- 6. TODAS as políticas RLS existentes nas tabelas public e em storage.objects
--    (Essencial para detectar políticas antigas permissivas que precisem ser removidas)
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expr,
  with_check AS with_check_expr
FROM pg_policies
WHERE (schemaname = 'public')
   OR (schemaname = 'storage' AND tablename IN ('objects', 'buckets'))
ORDER BY schemaname, tablename, policyname;

-- 7. Privilégios atuais de tabela (PUBLIC, anon, authenticated, service_role)
SELECT
  table_schema,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
GROUP BY table_schema, table_name, grantee
ORDER BY table_name, grantee;

-- 8. Privilégios por coluna (especialmente para public.users e public.user_settings)
SELECT
  table_name,
  grantee,
  column_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS column_privileges
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('users', 'user_settings', 'notifications')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
GROUP BY table_name, grantee, column_name
ORDER BY table_name, grantee, column_name;

-- 9. Triggers existentes em auth.users e public.*
SELECT
  event_object_schema,
  event_object_table,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE event_object_schema IN ('auth', 'public')
ORDER BY event_object_schema, event_object_table, trigger_name;

-- 10. Configuração atual dos buckets e volume de objetos no Supabase Storage
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types,
  created_at,
  updated_at
FROM storage.buckets
ORDER BY id;

SELECT
  bucket_id,
  COUNT(*) AS total_objects,
  COALESCE(SUM(CASE WHEN (metadata->>'size') ~ '^[0-9]+$' THEN (metadata->>'size')::bigint ELSE 0 END), 0) AS total_bytes_reported
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;

-- 11. Total de usuários já cadastrados no Supabase Auth (para avaliar backfill)
SELECT
  COUNT(*) AS auth_users_total,
  COUNT(*) FILTER (WHERE email IS NOT NULL) AS auth_users_with_email
FROM auth.users;
