import { ScheduledPublication } from '../types';

export interface TikTokStatusResponse {
  configured: boolean;
  account: {
    connected: boolean;
    openId?: string;
    displayName?: string;
    username?: string;
    avatarUrl?: string;
    followerCount?: number;
    scope?: string;
    connectedAt?: string;
  } | null;
}

export interface TikTokAuthUrlResponse {
  configured: boolean;
  url?: string;
  redirectUri?: string;
  state?: string;
  message?: string;
}

// Fetch current TikTok authentication and connection status
export async function getTikTokConnectionStatus(): Promise<TikTokStatusResponse> {
  try {
    const res = await fetch('/api/auth/tiktok/status');
    if (!res.ok) {
      throw new Error(`Status check failed: ${res.statusText}`);
    }
    return await res.json();
  } catch (err) {
    console.warn('Erro ao verificar status do TikTok:', err);
    return { configured: false, account: null };
  }
}

// Fetch official TikTok OAuth authorization URL
export async function getTikTokAuthUrl(): Promise<TikTokAuthUrlResponse> {
  const res = await fetch('/api/auth/tiktok/url');
  if (!res.ok) {
    throw new Error('Falha ao obter URL de autenticação do TikTok');
  }
  return await res.json();
}

// Disconnect TikTok account
export async function disconnectTikTokAccount(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/tiktok/disconnect', { method: 'POST' });
    const data = await res.json();
    return Boolean(data.success);
  } catch (err) {
    console.error('Erro ao desconectar TikTok:', err);
    return false;
  }
}

// Direct Post publication service to TikTok Official API
export async function publishToTikTokDirectPost(
  publication: ScheduledPublication,
  userId?: string
): Promise<{
  success: boolean;
  publishId?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/tiktok/publish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: userId || publication.userId || 'default_user',
        publicationId: publication.id,
        title: publication.title,
        description: publication.description,
        videoUrl: publication.videoUrl,
        storagePath: publication.storagePath,
        thumbnail: publication.thumbnail,
        duration: publication.duration,
        scheduledTime: publication.scheduledTime,
      }),
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Falha de conexão com o serviço TikTok',
    };
  }
}
