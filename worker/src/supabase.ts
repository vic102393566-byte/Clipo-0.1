import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import { AuthenticatedUser } from './types.js';

export const SUPABASE_VIDEOS_BUCKET = 'clipo-videos';

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Configurações do Supabase ausentes no servidor. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente do worker.'
    );
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseAdminClient;
}

/**
 * Validates the user's Supabase JWT access token sent in Authorization header.
 * Returns the authenticated user object or null if invalid/expired.
 */
export async function authenticateSupabaseUser(
  authHeader?: string
): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  try {
    const client = getSupabaseAdminClient();
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user?.id) {
      return null;
    }

    return {
      id: data.user.id,
      email: data.user.email,
    };
  } catch (err: any) {
    console.warn('[Supabase Auth Worker] Falha ao verificar token do usuário:', err.message);
    return null;
  }
}

/**
 * Downloads a video from the private Supabase bucket 'clipo-videos'.
 * The original file is purely read, remaining 100% intact and untouched.
 * Path is strictly validated to ensure it belongs to the authenticated user.
 */
export async function downloadVideoFromStorage(
  storagePath: string,
  destinationLocalPath: string,
  expectedUserId: string
): Promise<void> {
  // Validações rigorosas de caminho
  if (!storagePath || typeof storagePath !== 'string') {
    throw new Error('Caminho de armazenamento inválido.');
  }

  if (storagePath.includes('..') || storagePath.includes('\0') || storagePath.startsWith('/')) {
    throw new Error('Caminho de armazenamento inseguro (tentativa de directory traversal detectada).');
  }

  if (!storagePath.startsWith(`${expectedUserId}/`)) {
    throw new Error('Violação de segurança: o arquivo não pertence ao usuário autenticado.');
  }

  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage
    .from(SUPABASE_VIDEOS_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new Error(
      `Falha ao baixar vídeo do Supabase Storage (${storagePath}): ${error?.message || 'Arquivo não encontrado'}`
    );
  }

  const arrayBuffer = await data.arrayBuffer();
  await fs.promises.writeFile(destinationLocalPath, Buffer.from(arrayBuffer));
}

/**
 * Uploads a cut segment, thumbnail or subtitle file back to Supabase Storage
 */
export async function uploadFileToStorage(
  localFilePath: string,
  storagePath: string,
  contentType: string
): Promise<void> {
  const client = getSupabaseAdminClient();
  const fileBuffer = await fs.promises.readFile(localFilePath);

  const { error } = await client.storage
    .from(SUPABASE_VIDEOS_BUCKET)
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Erro ao enviar arquivo para o Supabase Storage (${storagePath}): ${error.message}`);
  }
}

/**
 * Creates a signed URL for a newly uploaded segment, thumbnail or subtitle file
 */
export async function createSignedUrlForPath(
  storagePath: string,
  expiresInSeconds: number = 604800 // 7 dias
): Promise<string> {
  const client = getSupabaseAdminClient();
  const { data, error } = await client.storage
    .from(SUPABASE_VIDEOS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new Error(`Erro ao gerar Signed URL para ${storagePath}: ${error?.message || 'Desconhecido'}`);
  }

  return data.signedUrl;
}

/**
 * Removes partial cut outputs of a specific job from Supabase Storage
 * Strictly restricted to `${userId}/videos/cuts/${jobId}/`.
 * The original video and all other folders are completely untouched.
 */
export async function cleanupJobCutsFromStorage(
  userId: string,
  jobId: string
): Promise<void> {
  if (!userId || !jobId) return;

  try {
    const client = getSupabaseAdminClient();
    const folderPath = `${userId}/videos/cuts/${jobId}`;

    const { data: list, error: listError } = await client.storage
      .from(SUPABASE_VIDEOS_BUCKET)
      .list(folderPath);

    if (listError || !list || list.length === 0) {
      return;
    }

    const filesToRemove = list
      .filter((item) => item.name && item.id)
      .map((item) => `${folderPath}/${item.name}`);

    if (filesToRemove.length > 0) {
      await client.storage.from(SUPABASE_VIDEOS_BUCKET).remove(filesToRemove);
    }
  } catch (err: any) {
    console.warn(`[Supabase Cleanup] Erro ao limpar cortes parciais do job ${jobId}:`, err.message);
  }
}

/**
 * Removes partial subtitle outputs of a specific job from Supabase Storage
 * Strictly restricted to `${userId}/videos/subtitles/${jobId}/`.
 */
export async function cleanupJobSubtitlesFromStorage(
  userId: string,
  jobId: string
): Promise<void> {
  if (!userId || !jobId) return;

  try {
    const client = getSupabaseAdminClient();
    const folderPath = `${userId}/videos/subtitles/${jobId}`;

    const { data: list, error: listError } = await client.storage
      .from(SUPABASE_VIDEOS_BUCKET)
      .list(folderPath);

    if (listError || !list || list.length === 0) {
      return;
    }

    const filesToRemove = list
      .filter((item) => item.name && item.id)
      .map((item) => `${folderPath}/${item.name}`);

    if (filesToRemove.length > 0) {
      await client.storage.from(SUPABASE_VIDEOS_BUCKET).remove(filesToRemove);
    }
  } catch (err: any) {
    console.warn(`[Supabase Cleanup] Erro ao limpar legendas parciais do job ${jobId}:`, err.message);
  }
}
