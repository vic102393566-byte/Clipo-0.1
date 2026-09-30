import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as tus from 'tus-js-client';
import { authService, DEFAULT_DEMO_USER } from './authService';

/**
 * =========================================================================
 * CLIPO - INTEGRAÇÃO OFICIAL COM SUPABASE STORAGE & DATABASE
 * =========================================================================
 * 
 * REQUISITOS ARQUITETURAIS:
 * 1. Bucket privado: 'clipo-videos'
 * 2. Estrutura de pastas por usuário: {ID_DO_USUARIO}/videos/{nome-do-arquivo}
 * 3. Binários de vídeo NUNCA são armazenados no PostgreSQL (apenas Storage)
 * 4. Vídeos grandes (> 6 MB) utilizam Upload Resumível (TUS) do Supabase Storage
 * 5. Nenhum segredo ou Service Role Key é exposto no frontend (apenas VITE_SUPABASE_ANON_KEY)
 * 6. Preparado para Supabase Auth (auth.uid() = ID_DO_USUARIO)
 * =========================================================================
 */

export const SUPABASE_VIDEOS_BUCKET = 'clipo-videos';

// Variáveis de ambiente padrão do Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Verifica se as credenciais do Supabase estão configuradas no ambiente
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl !== 'MY_SUPABASE_URL' &&
    !supabaseUrl.includes('placeholder') &&
    supabaseAnonKey !== 'MY_SUPABASE_ANON_KEY'
  );
}

/**
 * Instância do cliente Supabase para o Frontend
 * Utiliza EXCLUSIVAMENTE a chave anônima pública (ANON KEY), nunca a Service Role Key.
 */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Obtém o ID efetivo do usuário:
 * 1. Prioriza a sessão do Supabase Auth (auth.uid()) caso o usuário esteja autenticado via Supabase
 * 2. Em fallback, utiliza o usuário da sessão do authService ou o usuário padrão
 */
export async function getEffectiveUserId(): Promise<string> {
  try {
    if (isSupabaseConfigured()) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user?.id) {
        return data.session.user.id;
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar sessão do Supabase Auth:', err);
  }

  const localUser = authService.getCurrentUser();
  return localUser?.id || DEFAULT_DEMO_USER.id;
}

/**
 * Obtém o token de acesso (JWT) para autenticação em requisições Storage (RLS)
 */
export async function getEffectiveAccessToken(): Promise<string> {
  try {
    if (isSupabaseConfigured()) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        return data.session.access_token;
      }
    }
  } catch (err) {
    console.warn('Erro ao obter token do Supabase:', err);
  }
  return supabaseAnonKey;
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
 */
export function buildUserVideoStoragePath(userId: string, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  // Adiciona timestamp para evitar sobreposição acidental de arquivos de mesmo nome
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
 * Gera uma URL assinada (Signed URL) para o vídeo no bucket privado 'clipo-videos'
 * Padrão: 24 horas de validade (86400 segundos)
 */
export async function createSignedVideoUrl(
  storagePath: string,
  expiresInSeconds: number = 86400
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase.storage
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
 * Realiza upload de vídeo para o Supabase Storage.
 * - Para arquivos grandes (> 6 MB): utiliza o protocolo Resumível TUS (tus-js-client)
 * - Para arquivos menores (<= 6 MB): utiliza o upload direto do SDK Supabase
 */
export async function uploadVideoToSupabaseStorage(
  file: File | Blob,
  fileName: string,
  options: UploadOptions = {}
): Promise<SupabaseUploadResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase não configurado. Defina as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.'
    );
  }

  const effectiveUserId = options.userId || (await getEffectiveUserId());
  const storagePath = buildUserVideoStoragePath(effectiveUserId, fileName);
  const sizeBytes = file.size;
  const isLargeFile = sizeBytes > 6 * 1024 * 1024; // > 6MB: usa TUS Resumable Upload

  console.log(`[Supabase Storage] Iniciando upload: ${storagePath} (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) | Modo: ${isLargeFile ? 'TUS Resumable' : 'Standard Upload'}`);

  if (isLargeFile && typeof window !== 'undefined') {
    // -------------------------------------------------------------
    // UPLOAD RESUMÍVEL / TUS DO SUPABASE STORAGE (Para vídeos grandes)
    // -------------------------------------------------------------
    const accessToken = await getEffectiveAccessToken();
    const tusEndpoint = `${supabaseUrl}/storage/v1/upload/resumable`;

    return new Promise((resolve, reject) => {
      let tusUpload: tus.Upload | null = null;

      tusUpload = new tus.Upload(file, {
        endpoint: tusEndpoint,
        retryDelays: [0, 1000, 3000, 5000, 10000],
        headers: {
          apikey: supabaseAnonKey,
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
          // Gera a URL assinada inicial de visualização (24 horas)
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
    const { error } = await supabase.storage
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
  if (!isSupabaseConfigured() || !storagePath) return false;

  try {
    const { error } = await supabase.storage
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
