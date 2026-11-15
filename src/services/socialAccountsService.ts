import { SocialPlatform } from '../types';

export interface AuthUrlResponse {
  configured: boolean;
  url?: string;
  message?: string;
  missingKeys?: string[];
  redirectUri: string;
  scopes: string;
  setupUrl?: string;
}

export interface PlatformConnectionStatus {
  connected: boolean;
  configured: boolean;
  connectedAt?: string;
  account?: {
    id: string;
    name: string;
    handle: string;
    avatarUrl?: string;
    followerCount?: number;
    followersFormatted?: string;
    scope?: string;
  } | null;
}

export interface AllConnectionsStatusResponse {
  youtube: PlatformConnectionStatus;
  instagram: PlatformConnectionStatus;
  tiktok: PlatformConnectionStatus;
  linkedin?: PlatformConnectionStatus;
}

export const socialAccountsService = {
  /**
   * Fetches the OAuth authorization URL for a specific platform from the server.
   * Never exposes client secrets to the browser.
   */
  async getAuthUrl(platform: SocialPlatform, userId: string): Promise<AuthUrlResponse> {
    const res = await fetch(`/api/auth/${platform}/url?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      throw new Error(`Falha ao obter URL de autorização para ${platform} (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Securely disconnects a social media account on the backend for this user.
   */
  async disconnect(platform: SocialPlatform, userId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/auth/${platform}/disconnect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!res.ok) {
      throw new Error(`Falha ao desconectar conta do ${platform} (HTTP ${res.status})`);
    }
    return res.json();
  },

  /**
   * Retrieves connection status for all platforms for the specified user.
   */
  async getStatus(userId: string): Promise<AllConnectionsStatusResponse> {
    const res = await fetch(`/api/auth/status?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) {
      throw new Error(`Falha ao verificar status das conexões (HTTP ${res.status})`);
    }
    return res.json();
  },
};
