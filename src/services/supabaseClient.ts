import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';

/**
 * =========================================================================
 * CLIPO - INTEGRAÇÃO OFICIAL COM SUPABASE STORAGE & DATABASE
 * =========================================================================
 * 
 * REQUISITOS ARQUITETURAIS:
 * 1. Bucket privado: 'clipo-videos'
 * 2. Estrutura de pastas por usuário: {ID_DO_USUARIO}/videos/{nome-do-arquivo}
 * 3. Binários de vídeo NUNCA passam pelo proxy/backend em produção (upload direto para o Storage)
 * 4. Vídeos grandes (> 6 MB) utilizam Upload Resumível (TUS) do Supabase Storage
 * 5. Nenhum segredo ou Service Role Key é exposto no frontend (apenas VITE_SUPABASE_ANON_KEY ou nova Publishable Key)
 * 6. Suporte universal a variáveis de ambiente (.env, Vercel, Vite, process.env, runtime)
 * 7. Preparado para Supabase Auth (auth.uid() = UUID DO USUÁRIO NO SUPABASE)
 * =========================================================================
 */

export const SUPABASE_VIDEOS_BUCKET = 'clipo-videos';

/**
 * Limpa e higieniza valores de variáveis de ambiente:
 * - Remove aspas simples ou duplas ao redor do valor (ex: "https://..." -> https://...)
 * - Remove espaços em branco antes e depois
 */
export function cleanEnvValue(value?: string | null): string {
  if (!value || typeof value !== 'string') return '';
  let cleaned = value.trim();
  // Remove aspas duplas ou simples envolventes geradas ao copiar de .env para o painel da Vercel
  cleaned = cleaned.replace(/^["']+|["']+$/g, '').trim();
  return cleaned;
}

/**
 * Normaliza e valida a URL do Supabase:
 * - Remove aspas e espaços
 * - Rejeita placeholders
 * - Adiciona https:// caso o usuário tenha colado apenas "xxxx.supabase.co"
 * - Remove barras no final (ex: https://xxxx.supabase.co/ -> https://xxxx.supabase.co)
 */
export function normalizeSupabaseUrl(urlRaw?: string | null): string {
  let url = cleanEnvValue(urlRaw);
  if (!url) return '';
  if (
    url === 'MY_SUPABASE_URL' ||
    url.includes('placeholder') ||
    url.includes('your-project-id')
  ) {
    return '';
  }
  // Se o usuário colou o domínio sem protocolo https://
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `https://${url}`;
  }
  // Remove barras no final para evitar URLs com barra dupla
  return url.replace(/\/+$/, '');
}

/**
 * Normaliza e valida a chave do Supabase:
 * - Remove aspas e espaços
 * - Rejeita placeholders
 * - Suporta tanto a Anon Key clássica (JWT eyJhbGciOi...) quanto a nova Supabase Publishable Key (sb_publishable_... / sbp_...)
 */
export function normalizeSupabaseKey(keyRaw?: string | null): string {
  const key = cleanEnvValue(keyRaw);
  if (!key) return '';
  if (
    key === 'MY_SUPABASE_ANON_KEY' ||
    key.includes('placeholder') ||
    key.includes('your-anon-public-key')
  ) {
    return '';
  }
  return key;
}

// Armazenamento em memória para configuração dinâmica obtida em tempo de execução (/api/config)
let runtimeConfig: { url: string; anonKey: string } | null = null;

/**
 * Obtém a URL do Supabase consultando todas as fontes possíveis:
 * 1. Runtime cache (/api/config)
 * 2. Vite import.meta.env (VITE_SUPABASE_URL, SUPABASE_URL, NEXT_PUBLIC_SUPABASE_URL)
 * 3. window.__ENV__ ou window globals
 */
export function getSupabaseUrl(): string {
  if (runtimeConfig?.url) {
    return runtimeConfig.url;
  }

  const candidates: (string | undefined | null)[] = [
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.SUPABASE_URL,
    import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
    typeof window !== 'undefined' ? (window as any).__ENV__?.VITE_SUPABASE_URL : '',
    typeof window !== 'undefined' ? (window as any).__ENV__?.SUPABASE_URL : '',
    typeof window !== 'undefined' ? (window as any).VITE_SUPABASE_URL : '',
    typeof window !== 'undefined' ? (window as any).SUPABASE_URL : '',
  ];

  for (const cand of candidates) {
    const norm = normalizeSupabaseUrl(cand);
    if (norm) return norm;
  }

  return '';
}

/**
 * Obtém a Chave do Supabase (Anon Key ou Publishable Key) consultando todas as fontes possíveis:
 * 1. Runtime cache (/api/config)
 * 2. Vite import.meta.env com suporte a nomes modernos e legados
 * 3. window.__ENV__ ou window globals
 */
export function getSupabaseAnonKey(): string {
  if (runtimeConfig?.anonKey) {
    return runtimeConfig.anonKey;
  }

  const candidates: (string | undefined | null)[] = [
    // Nomes com prefixo VITE_
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    import.meta.env.VITE_SUPABASE_KEY,
    import.meta.env.VITE_SUPABASE_PUBLIC_KEY,
    // Nomes diretos (SUPABASE_)
    import.meta.env.SUPABASE_ANON_KEY,
    import.meta.env.SUPABASE_PUBLISHABLE_KEY,
    import.meta.env.SUPABASE_KEY,
    // Nomes do Next.js frequentemente configurados na Vercel
    import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    // Globals no window
    typeof window !== 'undefined' ? (window as any).__ENV__?.VITE_SUPABASE_ANON_KEY : '',
    typeof window !== 'undefined' ? (window as any).__ENV__?.VITE_SUPABASE_PUBLISHABLE_KEY : '',
    typeof window !== 'undefined' ? (window as any).VITE_SUPABASE_ANON_KEY : '',
    typeof window !== 'undefined' ? (window as any).VITE_SUPABASE_PUBLISHABLE_KEY : '',
  ];

  for (const cand of candidates) {
    const norm = normalizeSupabaseKey(cand);
    if (norm) return norm;
  }

  return '';
}

/**
 * Verifica se as credenciais do Supabase estão configuradas de forma válida no ambiente.
 */
export function isSupabaseConfigured(): boolean {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  return Boolean(url && key);
}

/**
 * Garante que a configuração do Supabase foi verificada.
 * Se ainda não estiver configurada no build estático, tenta buscar dinamicamente
 * do endpoint de runtime /api/config (disponível na Vercel e no servidor Node).
 */
export async function ensureSupabaseConfigured(): Promise<boolean> {
  if (isSupabaseConfigured()) {
    return true;
  }

  // Tenta obter do endpoint /api/config em tempo de execução
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        if (data?.configured && data.url && data.anonKey) {
          const normUrl = normalizeSupabaseUrl(data.url);
          const normKey = normalizeSupabaseKey(data.anonKey);
          if (normUrl && normKey) {
            runtimeConfig = { url: normUrl, anonKey: normKey };
            currentClient = null; // invalida cache do cliente para recriar
            console.log('[Supabase Client] Configuração carregada dinamicamente via /api/config com sucesso.');
            return true;
          }
        }
      }
    } catch (err) {
      console.warn('[Supabase Client] Consulta a /api/config ignorada:', err);
    }
  }

  return isSupabaseConfigured();
}

/**
 * Retorna o status detalhado da configuração do Supabase
 */
export function getSupabaseConfigStatus(): { configured: boolean; url: string; hasKey: boolean; error?: string } {
  const configured = isSupabaseConfigured();
  const url = getSupabaseUrl();
  const hasKey = Boolean(getSupabaseAnonKey());
  return {
    configured,
    url,
    hasKey,
    error: configured
      ? undefined
      : 'Supabase Storage não está configurado neste ambiente. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  };
}

/**
 * Detecta se a aplicação está rodando em ambiente de produção (Vercel, Cloud Run, deploy real)
 */
export function isProductionEnvironment(): boolean {
  if (import.meta.env.PROD) return true;
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.local');
  }
  return false;
}

/**
 * Valida se uma string é um UUID válido no padrão RFC 4122 (utilizado pelo Supabase Auth)
 */
export function isUUID(str?: string | null): boolean {
  if (!str || typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str.trim());
}

// Instância interna dinâmica do cliente Supabase
let currentClient: SupabaseClient | null = null;
let currentClientUrl = '';
let currentClientKey = '';

/**
 * Cria ou recupera a instância ativa do cliente Supabase.
 * Recria automaticamente se os parâmetros de configuração forem atualizados em tempo de execução.
 */
export function getSupabaseClient(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!currentClient || currentClientUrl !== url || currentClientKey !== key) {
    currentClientUrl = url;
    currentClientKey = key;
    currentClient = createClient(
      url || 'https://placeholder.supabase.co',
      key || 'placeholder-anon-key',
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      }
    );
  }
  return currentClient;
}

/**
 * Proxy seguro para exportação singleton de 'supabase'.
 * Encaminha todas as chamadas de propriedades e métodos para o cliente ativo, garantindo
 * que qualquer atualização de credenciais seja refletida imediatamente.
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

/**
 * Obtém o UUID real do usuário autenticado no Supabase Auth.
 * NUNCA retorna IDs legados como 'user_vicente_1', 'usr_...' ou DEFAULT_DEMO_USER para o Storage.
 * Garante compatibilidade total com as políticas RLS do bucket 'clipo-videos' ((storage.foldername(name))[1] = auth.uid()::text).
 */
export async function getEffectiveSupabaseUserId(): Promise<string | null> {
  await ensureSupabaseConfigured();
  if (!isSupabaseConfigured()) {
    return null;
  }

  try {
    const client = getSupabaseClient();
    const { data: sessionData } = await client.auth.getSession();
    const sessionUserId = sessionData?.session?.user?.id;
    if (sessionUserId && isUUID(sessionUserId)) {
      return sessionUserId;
    }

    const { data: userData } = await client.auth.getUser();
    const userId = userData?.user?.id;
    if (userId && isUUID(userId)) {
      return userId;
    }
  } catch (err) {
    console.warn('[Supabase Auth] Erro ao consultar sessão:', err);
  }

  return null;
}

/**
 * Compatibilidade legada com getEffectiveUserId.
 * Se houver sessão Supabase, retorna o UUID.
 * Caso contrário, retorna 'unauthenticated'.
 */
export async function getEffectiveUserId(): Promise<string> {
  const supaId = await getEffectiveSupabaseUserId();
  if (supaId) return supaId;
  return 'unauthenticated';
}

/**
 * Obtém o token de acesso (JWT) para autenticação em requisições Storage (RLS)
 */
export async function getEffectiveAccessToken(): Promise<string> {
  try {
    await ensureSupabaseConfigured();
    if (isSupabaseConfigured()) {
      const client = getSupabaseClient();
      const { data } = await client.auth.getSession();
      if (data?.session?.access_token) {
        return data.session.access_token;
      }
    }
  } catch (err) {
    console.warn('Erro ao obter token do Supabase:', err);
  }
  return getSupabaseAnonKey();
}

/**
 * Higieniza o nome do arquivo para garantir compatibilidade com URLs e S3/Supabase Storage
 */
export function sanitizeFileName(originalName: string): string {
  const clean = originalName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_') // caracteres seguros
    .replace(/_+/g, '_');
  return clean || `video_${Date.now()}.mp4`;
}

/**
 * Constrói o caminho estrito no Storage conforme requisito:
 * Formato: {ID_DO_USUARIO}/videos/{nome-do-arquivo}
 * O ID do usuário DEVE ser o UUID do Supabase Auth para atender às regras RLS.
 */
export function buildUserVideoStoragePath(userId: string, fileName: string): string {
  if (!isUUID(userId)) {
    console.warn(`[Supabase Storage] Atenção: ID de usuário "${userId}" não é um UUID padrão.`);
  }
  const safeName = sanitizeFileName(fileName);
  const uniqueName = `${Date.now()}_${safeName}`;
  return `${userId}/videos/${uniqueName}`;
}

export interface UploadOptions {
  userId?: string;
  onProgress?: (percent: number, bytesUploaded: number, bytesTotal: number) => void;
  signal?: AbortSignal;
}

export interface SupabaseUploadResult {
  success: boolean;
  storagePath: string;
  signedUrl: string;
  sizeBytes: number;
  error?: string;
}

/**
 * Gera uma URL assinada (Signed URL) para o vídeo no bucket privado 'clipo-videos'.
 * Padrão: 24 horas de validade (86400 segundos).
 * Preserva o bucket privado e respeita as permissões RLS.
 */
export async function createSignedVideoUrl(
  storagePath: string,
  expiresInSeconds: number = 86400
): Promise<string | null> {
  await ensureSupabaseConfigured();
  if (!isSupabaseConfigured()) return null;

  try {
    const client = getSupabaseClient();
    const { data, error } = await client.storage
      .from(SUPABASE_VIDEOS_BUCKET)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error) {
      console.error(`[Supabase Storage] Erro ao gerar URL assinada para ${storagePath}:`, error.message);
      return null;
    }

    return data?.signedUrl || null;
  } catch (err) {
    console.error('[Supabase Storage] Falha ao solicitar URL assinada:', err);
    return null;
  }
}

/**
 * Realiza upload de vídeo DIRETAMENTE para o Supabase Storage.
 * - Para arquivos maiores que 6 MB: utiliza o protocolo Resumível TUS (tus-js-client)
 * - Para arquivos menores (<= 6 MB): utiliza o upload direto do SDK Supabase
 * - Garante o uso do UUID real do usuário autenticado no caminho do arquivo
 */
export async function uploadVideoToSupabaseStorage(
  file: File | Blob,
  fileName: string,
  options: UploadOptions = {}
): Promise<SupabaseUploadResult> {
  await ensureSupabaseConfigured();
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase Storage não está configurado neste ambiente. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.'
    );
  }

  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  // Requisito 7: Obter UUID real do usuário autenticado no Supabase
  let supabaseUserId: string | null = null;
  if (options.userId && isUUID(options.userId)) {
    supabaseUserId = options.userId;
  } else {
    supabaseUserId = await getEffectiveSupabaseUserId();
  }

  if (!supabaseUserId) {
    throw new Error(
      'Sessão de autenticação do Supabase não encontrada. Faça login para enviar vídeos ao armazenamento seguro (RLS).'
    );
  }

  const storagePath = buildUserVideoStoragePath(supabaseUserId, fileName);
  const sizeBytes = file.size;
  const isLargeFile = sizeBytes > 6 * 1024 * 1024; // > 6MB: usa TUS Resumable Upload

  console.log(`[Supabase Storage] Iniciando upload: ${storagePath} (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) | Protocolo: ${isLargeFile ? 'TUS Resumable' : 'Direct SDK'}`);

  if (isLargeFile && typeof window !== 'undefined') {
    // -------------------------------------------------------------
    // UPLOAD RESUMÍVEL / TUS DO SUPABASE STORAGE (> 6 MB)
    // -------------------------------------------------------------
    const accessToken = await getEffectiveAccessToken();
    const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

    return new Promise((resolve, reject) => {
      let tusUpload: tus.Upload | null = null;

      tusUpload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${accessToken}`,
          'x-upsert': 'true',
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        metadata: {
          bucketName: SUPABASE_VIDEOS_BUCKET,
          objectName: storagePath,
          contentType: file.type || 'video/mp4',
          cacheControl: '3600',
        },
        chunkSize: 6 * 1024 * 1024, // 6 MB por chunk (recomendado pelo Supabase)
        onError: (error) => {
          console.error('[Supabase Storage TUS] Erro no upload resumível:', error);
          reject(new Error(`Falha no upload TUS para o Supabase Storage: ${error.message}`));
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const percent = Math.min(100, Math.round((bytesUploaded / bytesTotal) * 100));
          if (options.onProgress) {
            options.onProgress(percent, bytesUploaded, bytesTotal);
          }
        },
        onSuccess: async () => {
          console.log(`[Supabase Storage TUS] Upload resumível concluído com sucesso: ${storagePath}`);
          const signedUrl = (await createSignedVideoUrl(storagePath, 86400)) || '';
          resolve({
            success: true,
            storagePath,
            signedUrl,
            sizeBytes,
          });
        },
      });

      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          if (tusUpload) {
            tusUpload.abort();
            console.warn('[Supabase Storage TUS] Upload cancelado pelo usuário.');
          }
        });
      }

      tusUpload.start();
    });
  } else {
    // -------------------------------------------------------------
    // UPLOAD DIRETO DO SUPABASE (Para arquivos menores <= 6 MB)
    // -------------------------------------------------------------
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(SUPABASE_VIDEOS_BUCKET)
      .upload(storagePath, file, {
        contentType: file.type || 'video/mp4',
        upsert: true,
      });

    if (error) {
      console.error('[Supabase Storage] Erro no upload direto:', error);
      throw new Error(`Erro ao enviar arquivo para o Supabase Storage: ${error.message}`);
    }

    if (options.onProgress) {
      options.onProgress(100, sizeBytes, sizeBytes);
    }

    const signedUrl = (await createSignedVideoUrl(storagePath, 86400)) || '';
    return {
      success: true,
      storagePath,
      signedUrl,
      sizeBytes,
    };
  }
}

/**
 * Remove um arquivo de vídeo do bucket Supabase Storage
 */
export async function deleteVideoFromSupabaseStorage(storagePath: string): Promise<boolean> {
  await ensureSupabaseConfigured();
  if (!isSupabaseConfigured() || !storagePath) return false;

  try {
    const client = getSupabaseClient();
    const { error } = await client.storage
      .from(SUPABASE_VIDEOS_BUCKET)
      .remove([storagePath]);

    if (error) {
      console.error(`[Supabase Storage] Erro ao excluir vídeo (${storagePath}):`, error.message);
      return false;
    }
    console.log(`[Supabase Storage] Arquivo excluído com sucesso: ${storagePath}`);
    return true;
  } catch (err) {
    console.error('[Supabase Storage] Falha ao tentar excluir vídeo:', err);
    return false;
  }
}

/**
 * Diferencia com precisão a causa de erros durante o upload (Requisito 10):
 * - Limite do plano ativo
 * - Erro do Supabase Storage
 * - Erro HTTP 413 da infraestrutura
 * - Erro de autenticação / RLS
 * - Erro de rede / conexão
 */
export function categorizeUploadError(
  err: any,
  options?: {
    fileSizeBytes?: number;
    planTier?: string;
    isEn?: boolean;
  }
): string {
  const isEn = Boolean(options?.isEn);
  const rawMsg = err?.message || (typeof err === 'string' ? err : '');
  const status = err?.status || err?.statusCode || (err?.response ? err.response.status : undefined);
  const lower = (rawMsg + ' ' + (status || '')).toLowerCase();

  // 1. Limite do plano ativo
  if (err?.code === 'PLAN_LIMIT_EXCEEDED' || err?.isPlanLimit || lower.includes('excede o limite do plano') || lower.includes('espaço total da conta insuficiente')) {
    return rawMsg || (isEn
      ? 'File exceeds active plan limits. Please upgrade your plan.'
      : 'Arquivo excede os limites do plano ativo. Faça upgrade para enviar arquivos maiores.');
  }

  // 2. Erro de autenticação / RLS do Supabase
  if (
    status === 401 ||
    status === 403 ||
    lower.includes('row-level security') ||
    lower.includes('violates row-level security') ||
    lower.includes('jwt') ||
    lower.includes('unauthorized') ||
    lower.includes('permission denied') ||
    lower.includes('não autenticado') ||
    lower.includes('sessão de autenticação')
  ) {
    return isEn
      ? 'Permission denied (RLS) in Supabase Storage. Ensure your user is authenticated and bucket "clipo-videos" policies allow uploads to your user folder.'
      : 'Permissão negada (RLS) no Supabase Storage. Certifique-se de que o usuário está autenticado e que as políticas do bucket "clipo-videos" permitem gravação na pasta do seu UUID.';
  }

  // 3. Erro HTTP 413 da infraestrutura
  if (
    status === 413 ||
    lower.includes('413') ||
    lower.includes('payload too large') ||
    lower.includes('entity too large')
  ) {
    return isEn
      ? 'HTTP 413 Error (Payload Too Large): The reverse proxy rejected the payload size. In production, uploads must go directly to Supabase Storage via TUS instead of the proxy server.'
      : 'Erro HTTP 413 (Payload Too Large): O servidor proxy intermediário rejeitou o tamanho da requisição. Em produção, envie diretamente para o Supabase Storage via TUS em vez do servidor proxy.';
  }

  // 4. Erro de configuração do Supabase Storage
  if (lower.includes('supabase storage não está configurado') || lower.includes('supabase storage is not configured')) {
    return isEn
      ? 'Supabase Storage is not configured in this environment. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
      : 'Supabase Storage não está configurado neste ambiente. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
  }

  if (lower.includes('bucket not found') || lower.includes('bucket "clipo-videos"')) {
    return isEn
      ? 'Bucket "clipo-videos" not found in Supabase Storage. Please create the private bucket "clipo-videos" in your Supabase Dashboard.'
      : 'Bucket "clipo-videos" não encontrado no Supabase Storage. Crie o bucket privado "clipo-videos" no painel do Supabase.';
  }

  // 5. Erro do Supabase Storage / TUS
  if (lower.includes('supabase') || lower.includes('tus')) {
    return rawMsg;
  }

  // 6. Erro de rede / conexão / timeout
  if (
    err?.name === 'TypeError' ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('timeout') ||
    lower.includes('conexão') ||
    lower.includes('tempo limite')
  ) {
    return isEn
      ? 'Network connection error during video transfer. Please check your internet connection and try again.'
      : 'Falha na conexão de rede durante a transferência do vídeo. Verifique sua conexão e tente novamente.';
  }

  return rawMsg || (isEn ? 'Failed to upload video. Please try again.' : 'Falha no processamento do upload. Tente novamente.');
}
