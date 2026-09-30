import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, ChildProcess } from 'child_process';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Static media files for streaming video and thumbnails with full Range header support
const mediaDir = path.resolve(__dirname, 'public/media');
if (!fs.existsSync(mediaDir)) {
  fs.mkdirSync(mediaDir, { recursive: true });
}
app.use('/media', express.static(mediaDir, {
  setHeaders: (res) => {
    res.set('Accept-Ranges', 'bytes');
    res.set('Access-Control-Allow-Origin', '*');
  },
}));

// Configure Multer for processing video uploads
const uploadsDir = path.resolve(mediaDir, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    const cleanName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    cb(null, `${cleanName}_${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 * 1024 }, // 10 GB max (permite podcasts, lives e vídeos de 2 horas)
});

// User-scoped secure storage for social media OAuth tokens and profiles
// Tokens are stored securely on the backend ONLY and never exposed to the client
interface OAuthTokenRecord {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
}

interface SocialAccountData {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string;
  followerCount?: number;
  followersFormatted?: string;
  scope?: string;
}

interface UserPlatformConnection {
  userId: string;
  platform: 'youtube' | 'instagram' | 'tiktok';
  connected: boolean;
  connectedAt?: string;
  account?: SocialAccountData;
  tokens?: OAuthTokenRecord; // Stored securely on backend ONLY
}

// User-scoped map: key = `${userId}:${platform}`
const userSocialConnections = new Map<string, UserPlatformConnection>();

// Secure file store on backend only (strictly outside the project web root)
const TOKENS_STORE_DIR = path.resolve('/tmp', 'clipo_storage_secure');
const TOKENS_STORE_FILE = path.resolve(TOKENS_STORE_DIR, 'social_connections.json');

function loadSocialConnectionsFromDisk() {
  try {
    if (fs.existsSync(TOKENS_STORE_FILE)) {
      const content = fs.readFileSync(TOKENS_STORE_FILE, 'utf-8');
      const items = JSON.parse(content);
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && item.userId && item.platform) {
            userSocialConnections.set(`${item.userId}:${item.platform}`, item);
          }
        }
        console.log(`[OAuth] ${userSocialConnections.size} conexões sociais carregadas com segurança do disco.`);
      }
    }
  } catch (err) {
    console.error('Erro ao ler conexões sociais do disco:', err);
  }
}

function saveSocialConnectionsToDisk() {
  try {
    if (!fs.existsSync(TOKENS_STORE_DIR)) {
      fs.mkdirSync(TOKENS_STORE_DIR, { recursive: true });
    }
    const items = Array.from(userSocialConnections.values());
    fs.writeFileSync(TOKENS_STORE_FILE, JSON.stringify(items, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao salvar conexões sociais no disco:', err);
  }
}

// Load persisted connections upon server start
loadSocialConnectionsFromDisk();

function formatFollowersCount(count?: number): string {
  if (!count || count <= 0) return '0';
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

function encodeOAuthState(userId: string, platform: string): string {
  const payload = {
    userId: userId || 'default_user',
    platform,
    nonce: Math.random().toString(36).substring(7),
    ts: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeOAuthState(stateStr?: any): { userId: string; platform: string } {
  if (!stateStr) return { userId: 'default_user', platform: 'unknown' };
  try {
    const raw = Buffer.from(String(stateStr), 'base64url').toString('utf8');
    const parsed = JSON.parse(raw);
    return {
      userId: parsed.userId || 'default_user',
      platform: parsed.platform || 'unknown',
    };
  } catch {
    return { userId: 'default_user', platform: 'unknown' };
  }
}

function renderOAuthSuccessPage(platformName: string, platformId: string, accountData: any) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${platformName} Conectado com Sucesso</title>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            background: #0B0F17;
            color: #ffffff;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          .card {
            background: #121724;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            padding: 32px;
            max-width: 440px;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          }
          .icon {
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: rgba(16, 185, 129, 0.15);
            color: #10b981;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 16px;
            font-size: 28px;
          }
          h2 { font-size: 18px; margin: 0 0 8px; color: #ffffff; }
          p { font-size: 13px; color: #94a3b8; margin: 0 0 16px; line-height: 1.5; }
          .spinner {
            display: inline-block;
            width: 18px;
            height: 18px;
            border: 2px solid rgba(255, 255, 255, 0.2);
            border-top-color: #f97316;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h2>Conta ${platformName} Conectada!</h2>
          <p>O Clipo autorizou sua conta com segurança via OAuth oficial. Finalizando autenticação...</p>
          <div class="spinner"></div>
        </div>
        <script>
          const accountData = ${JSON.stringify(accountData || { connected: true })};
          if (window.opener) {
            window.opener.postMessage({
              type: 'OAUTH_AUTH_SUCCESS',
              platform: '${platformId}',
              account: accountData
            }, '*');
            setTimeout(() => { window.close(); }, 1200);
          } else {
            setTimeout(() => { window.location.href = '/'; }, 1500);
          }
        </script>
      </body>
    </html>
  `;
}

function renderOAuthErrorPage(platformName: string, platformId: string, errorDescription: string) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Autenticação ${platformName} - Erro</title>
        <meta charset="utf-8" />
        <style>
          body { font-family: system-ui, sans-serif; background: #0B0F17; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #121724; border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 24px; max-width: 420px; text-align: center; }
          h2 { color: #f43f5e; margin-top: 0; }
          p { font-size: 13px; color: #94a3b8; line-height: 1.5; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>Falha na Autorização</h2>
          <p>${errorDescription || 'Acesso não concedido ou cancelado pelo usuário.'}</p>
          <p style="color: #64748b; font-size: 12px; margin-top: 16px;">Esta janela será fechada automaticamente...</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'OAUTH_AUTH_ERROR', platform: '${platformId}', error: '${String(errorDescription).replace(/'/g, "\\'")}' }, '*');
            setTimeout(() => window.close(), 2500);
          }
        </script>
      </body>
    </html>
  `;
}

// Determine base URL: Always prioritize APP_URL per AI Studio OAuth skill guidelines
const getBaseAppUrl = () => {
  return (
    process.env.APP_URL ||
    'https://ais-dev-lfcxezhilf74k3anceyuue-460308902554.us-east1.run.app'
  );
};

// ==========================================
// 1. SOCIAL ACCOUNTS OAUTH ARCHITECTURE
// ==========================================

/**
 * Universal endpoint to check connection status for all platforms
 */
app.get('/api/auth/status', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');

  const ytConn = userSocialConnections.get(`${userId}:youtube`);
  const igConn = userSocialConnections.get(`${userId}:instagram`);
  const ttConn = userSocialConnections.get(`${userId}:tiktok`);

  const isYtConfigured = Boolean(process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);
  const isIgConfigured = Boolean(process.env.INSTAGRAM_CLIENT_ID || process.env.META_APP_ID);
  const isTtConfigured = Boolean(process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY);

  return res.json({
    youtube: {
      connected: ytConn?.connected ?? false,
      configured: isYtConfigured,
      connectedAt: ytConn?.connectedAt,
      account: ytConn?.connected ? ytConn.account : null,
    },
    instagram: {
      connected: igConn?.connected ?? false,
      configured: isIgConfigured,
      connectedAt: igConn?.connectedAt,
      account: igConn?.connected ? igConn.account : null,
    },
    tiktok: {
      connected: ttConn?.connected ?? false,
      configured: isTtConfigured,
      connectedAt: ttConn?.connectedAt,
      account: ttConn?.connected ? ttConn.account : null,
    },
  });
});

// ------------------------------------------
// 1.1 YOUTUBE (Google OAuth 2.0)
// ------------------------------------------

app.get('/api/auth/youtube/url', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${baseAppUrl}/api/auth/youtube/callback`;
  const scopes = 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/userinfo.profile';
  const state = encodeOAuthState(userId, 'youtube');

  if (!clientId) {
    return res.status(200).json({
      configured: false,
      message: 'Credenciais do YouTube (Google OAuth) não configuradas no ambiente.',
      missingKeys: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
      redirectUri,
      scopes,
      setupUrl: 'https://console.cloud.google.com/apis/credentials',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
    state: state,
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  return res.json({
    configured: true,
    url: authUrl,
    redirectUri,
    state,
  });
});

app.get(['/api/auth/youtube/callback', '/api/auth/youtube/callback/'], async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;
  const { userId } = decodeOAuthState(state);

  if (error) {
    console.error('YouTube OAuth error response:', error, error_description);
    return res.send(renderOAuthErrorPage('YouTube', 'youtube', String(error_description || error)));
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.YOUTUBE_REDIRECT_URI || `${baseAppUrl}/api/auth/youtube/callback`;

  try {
    if (code && clientId && clientSecret) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: String(code),
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        let channelName = 'Canal do YouTube';
        let channelHandle = '@youtube';
        let channelAvatar = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80';
        let subscriberCount = 0;
        let channelId = 'yt_channel';

        try {
          const channelRes = await fetch(
            'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
            { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
          );
          const channelJson = await channelRes.json();
          if (channelJson.items && channelJson.items.length > 0) {
            const item = channelJson.items[0];
            channelId = item.id;
            channelName = item.snippet?.title || channelName;
            channelHandle = item.snippet?.customUrl ? `@${item.snippet.customUrl.replace(/^@/, '')}` : `@${channelName.toLowerCase().replace(/\s+/g, '_')}`;
            channelAvatar = item.snippet?.thumbnails?.default?.url || channelAvatar;
            subscriberCount = parseInt(item.statistics?.subscriberCount || '0', 10);
          }
        } catch (fetchErr) {
          console.warn('Erro ao obter canal YouTube:', fetchErr);
        }

        const accountData: SocialAccountData = {
          id: channelId,
          name: channelName,
          handle: channelHandle,
          avatarUrl: channelAvatar,
          followerCount: subscriberCount,
          followersFormatted: formatFollowersCount(subscriberCount),
          scope: tokenData.scope,
        };

        userSocialConnections.set(`${userId}:youtube`, {
          userId,
          platform: 'youtube',
          connected: true,
          connectedAt: new Date().toISOString(),
          account: accountData,
          tokens: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            expiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
            tokenType: tokenData.token_type,
            scope: tokenData.scope,
          },
        });
        saveSocialConnectionsToDisk();

        return res.send(renderOAuthSuccessPage('YouTube', 'youtube', accountData));
      }
    }
  } catch (err: any) {
    console.error('Erro na troca de código YouTube:', err);
    return res.send(renderOAuthErrorPage('YouTube', 'youtube', err.message || 'Erro na troca de código OAuth.'));
  }

  return res.send(renderOAuthErrorPage('YouTube', 'youtube', 'Código ou credenciais ausentes.'));
});

app.post('/api/auth/youtube/disconnect', (req: Request, res: Response) => {
  const userId = String(req.body.userId || 'default_user');
  userSocialConnections.delete(`${userId}:youtube`);
  saveSocialConnectionsToDisk();
  return res.json({ success: true, message: 'Conta do YouTube desconectada com sucesso.' });
});

// ------------------------------------------
// 1.2 INSTAGRAM (Meta Graph API)
// ------------------------------------------

app.get('/api/auth/instagram/url', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  const clientId = process.env.INSTAGRAM_CLIENT_ID || process.env.META_APP_ID;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${baseAppUrl}/api/auth/instagram/callback`;
  const scopes = 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement';
  const state = encodeOAuthState(userId, 'instagram');

  if (!clientId) {
    return res.status(200).json({
      configured: false,
      message: 'Credenciais do Instagram (Meta App) não configuradas no ambiente.',
      missingKeys: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
      redirectUri,
      scopes,
      setupUrl: 'https://developers.facebook.com',
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    response_type: 'code',
    state: state,
  });

  const authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`;
  return res.json({
    configured: true,
    url: authUrl,
    redirectUri,
    state,
  });
});

app.get(['/api/auth/instagram/callback', '/api/auth/instagram/callback/'], async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;
  const { userId } = decodeOAuthState(state);

  if (error) {
    console.error('Instagram OAuth error response:', error, error_description);
    return res.send(renderOAuthErrorPage('Instagram', 'instagram', String(error_description || error)));
  }

  const clientId = process.env.INSTAGRAM_CLIENT_ID || process.env.META_APP_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET || process.env.META_APP_SECRET;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.INSTAGRAM_REDIRECT_URI || `${baseAppUrl}/api/auth/instagram/callback`;

  try {
    if (code && clientId && clientSecret) {
      const tokenRes = await fetch('https://graph.facebook.com/v19.0/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: String(code),
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        let accountName = 'Instagram Creator';
        let accountHandle = '@instagram.user';
        let avatarUrl = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80';
        let followerCount = 0;
        let igId = 'ig_account';

        try {
          const profileRes = await fetch(
            `https://graph.facebook.com/v19.0/me?fields=id,name,accounts{instagram_business_account{id,username,profile_picture_url,followers_count}}&access_token=${tokenData.access_token}`
          );
          const profileJson = await profileRes.json();
          const igBusiness = profileJson.accounts?.data?.[0]?.instagram_business_account;
          if (igBusiness) {
            igId = igBusiness.id;
            accountHandle = `@${igBusiness.username}`;
            accountName = profileJson.name || igBusiness.username;
            avatarUrl = igBusiness.profile_picture_url || avatarUrl;
            followerCount = igBusiness.followers_count || 0;
          } else if (profileJson.name) {
            accountName = profileJson.name;
          }
        } catch (fetchErr) {
          console.warn('Erro ao obter perfil Instagram:', fetchErr);
        }

        const accountData: SocialAccountData = {
          id: igId,
          name: accountName,
          handle: accountHandle,
          avatarUrl: avatarUrl,
          followerCount: followerCount,
          followersFormatted: formatFollowersCount(followerCount),
        };

        userSocialConnections.set(`${userId}:instagram`, {
          userId,
          platform: 'instagram',
          connected: true,
          connectedAt: new Date().toISOString(),
          account: accountData,
          tokens: {
            accessToken: tokenData.access_token,
            expiresIn: tokenData.expires_in,
            expiresAt: Date.now() + (tokenData.expires_in || 3600 * 24 * 60) * 1000,
            tokenType: tokenData.token_type,
          },
        });
        saveSocialConnectionsToDisk();

        return res.send(renderOAuthSuccessPage('Instagram', 'instagram', accountData));
      }
    }
  } catch (err: any) {
    console.error('Erro na troca de código Instagram:', err);
    return res.send(renderOAuthErrorPage('Instagram', 'instagram', err.message || 'Erro na troca de código OAuth.'));
  }

  return res.send(renderOAuthErrorPage('Instagram', 'instagram', 'Código ou credenciais ausentes.'));
});

app.post('/api/auth/instagram/disconnect', (req: Request, res: Response) => {
  const userId = String(req.body.userId || 'default_user');
  userSocialConnections.delete(`${userId}:instagram`);
  saveSocialConnectionsToDisk();
  return res.json({ success: true, message: 'Conta do Instagram desconectada com sucesso.' });
});

// ------------------------------------------
// 1.3 TIKTOK (Official v2 API)
// ------------------------------------------

app.get('/api/auth/tiktok/url', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${baseAppUrl}/api/auth/tiktok/callback`;
  const scope = 'user.info.basic,user.info.profile,video.upload,video.publish';
  const state = encodeOAuthState(userId, 'tiktok');

  if (!clientKey) {
    return res.status(200).json({
      configured: false,
      message: 'TIKTOK_CLIENT_KEY não configurada no ambiente.',
      missingKeys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
      redirectUri,
      requiredScopes: scope,
      setupUrl: 'https://developers.tiktok.com',
    });
  }

  const params = new URLSearchParams({
    client_key: clientKey,
    scope: scope,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: state,
  });

  const authUrl = `https://www.tiktok.com/v2/auth/authorize/?${params.toString()}`;
  return res.json({
    configured: true,
    url: authUrl,
    redirectUri,
    state,
  });
});

app.get(['/api/auth/tiktok/callback', '/api/auth/tiktok/callback/'], async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;
  const { userId } = decodeOAuthState(state);

  if (error) {
    console.error('TikTok OAuth error response:', error, error_description);
    return res.send(renderOAuthErrorPage('TikTok', 'tiktok', String(error_description || error)));
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || process.env.VITE_TIKTOK_CLIENT_SECRET;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || `${baseAppUrl}/api/auth/tiktok/callback`;

  try {
    if (code && clientKey && clientSecret) {
      const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cache-Control': 'no-cache',
        },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          code: String(code),
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.data && tokenData.data.access_token) {
        const {
          access_token,
          refresh_token,
          open_id,
          expires_in,
          refresh_expires_in,
          scope,
        } = tokenData.data;

        let userInfo = {
          display_name: 'Criador TikTok',
          avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          username: 'tiktok.user',
          follower_count: 0,
        };

        try {
          const userResponse = await fetch(
            'https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name,username,follower_count',
            { headers: { Authorization: `Bearer ${access_token}` } }
          );
          const userData = await userResponse.json();
          if (userData.data?.user) {
            userInfo = {
              display_name: userData.data.user.display_name || userInfo.display_name,
              avatar_url: userData.data.user.avatar_url || userInfo.avatar_url,
              username: userData.data.user.username || userInfo.username,
              follower_count: userData.data.user.follower_count || 0,
            };
          }
        } catch (fetchErr) {
          console.warn('Erro ao obter perfil do usuário TikTok:', fetchErr);
        }

        const accountData: SocialAccountData = {
          id: open_id,
          name: userInfo.display_name,
          handle: userInfo.username ? `@${userInfo.username}` : '@tiktok',
          avatarUrl: userInfo.avatar_url,
          followerCount: userInfo.follower_count,
          followersFormatted: formatFollowersCount(userInfo.follower_count),
          scope: scope,
        };

        userSocialConnections.set(`${userId}:tiktok`, {
          userId,
          platform: 'tiktok',
          connected: true,
          connectedAt: new Date().toISOString(),
          account: accountData,
          tokens: {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresIn: expires_in,
            expiresAt: Date.now() + (expires_in || 3600) * 1000,
            scope: scope,
          },
        });
        saveSocialConnectionsToDisk();

        return res.send(renderOAuthSuccessPage('TikTok', 'tiktok', accountData));
      }
    }
  } catch (ex: any) {
    console.error('Erro na troca de token TikTok:', ex);
    return res.send(renderOAuthErrorPage('TikTok', 'tiktok', ex.message || 'Erro ao trocar código por token.'));
  }

  return res.send(renderOAuthErrorPage('TikTok', 'tiktok', 'Código ou credenciais inválidas.'));
});

app.post('/api/auth/tiktok/disconnect', (req: Request, res: Response) => {
  const userId = String(req.body.userId || 'default_user');
  userSocialConnections.delete(`${userId}:tiktok`);
  saveSocialConnectionsToDisk();
  return res.json({ success: true, message: 'Conta TikTok desconectada com sucesso.' });
});

// ==========================================
// 2. TIKTOK VIDEO PUBLISHING SERVICE (Official v2 API)
// ==========================================
// Prepares and executes official direct post publishing using TikTok Direct Post API
// Flow:
// 1. POST https://open.tiktokapis.com/v2/post/publish/video/init/
// 2. Upload video binary chunks to TikTok upload_url
// 3. Status check: POST https://open.tiktokapis.com/v2/post/publish/status/fetch/
app.post('/api/tiktok/publish', async (req: Request, res: Response) => {
  const { title, description, videoUrl, scheduledTime, userId = 'default_user' } = req.body;

  const connection = userSocialConnections.get(`${userId}:tiktok`);
  const accessToken = connection?.tokens?.accessToken;

  if (!connection || !accessToken) {
    return res.status(401).json({
      success: false,
      error: 'Nenhuma conta TikTok conectada via OAuth ou token expirado para este usuário.',
      requiresAuth: true,
    });
  }

  try {
    // Step 1: Initialize Direct Post on TikTok Official v2 API
    const initResponse = await fetch(
      'https://open.tiktokapis.com/v2/post/publish/video/init/',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          post_info: {
            title: description ? `${title}\n\n${description}` : title,
            privacy_level: 'PUBLIC_TO_EVERYONE',
            disable_duet: false,
            disable_stitch: false,
            disable_comment: false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source: 'FILE_UPLOAD',
            video_size: 1024 * 1024 * 15, // standard chunk or target size
            chunk_size: 1024 * 1024 * 15,
            total_chunk_count: 1,
          },
        }),
      }
    );

    const initData = await initResponse.json();

    if (initData.error && initData.error.code !== 'ok') {
      return res.status(400).json({
        success: false,
        error: initData.error.message || 'Erro ao inicializar postagem no TikTok',
        details: initData.error,
      });
    }

    return res.json({
      success: true,
      publishId: initData.data?.publish_id,
      uploadUrl: initData.data?.upload_url,
      message: 'Publicação iniciada com sucesso na API Oficial do TikTok.',
    });
  } catch (error: any) {
    console.error('TikTok publish error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Erro de comunicação com a API Oficial do TikTok',
    });
  }
});

// ==========================================
// 3. PAYMENT & SUBSCRIPTION WEBHOOK STRUCTURE
// ==========================================

interface WebhookReceivedEvent {
  id: string;
  receivedAt: string;
  event: string;
  planId: string;
  userEmail: string;
  status: string;
  paymentId: string;
  amount: number;
  currency: string;
  rawPayload: any;
}

// In-memory record of recent webhook events for monitoring and frontend polling
const receivedWebhookEvents: WebhookReceivedEvent[] = [];

// Current active subscription stored server-side for sync
let serverSubscriptionState = {
  planId: 'pro',
  status: 'ativa',
  startedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  renewsAt: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
  lastPaymentId: 'pay_live_8912304812',
  paymentMethod: 'cartao',
  billingInterval: 'mensal',
  updatedAt: new Date().toISOString(),
};

/**
 * Standard Webhook receiver endpoint for future payment gateways (Stripe, Mercado Pago, Asaas, Pagar.me, etc.)
 * Receives JSON webhook notification and automatically transitions the subscription state.
 */
app.post(['/api/webhook/payment', '/api/webhook/payment/'], (req: Request, res: Response) => {
  try {
    const payload = req.body || {};
    const signature = req.headers['x-webhook-signature'] || req.headers['stripe-signature'] || '';
    
    // Extract standardized fields from generic or vendor-specific payloads
    const eventType = payload.event || payload.type || 'payment.succeeded';
    const planId = payload.planId || payload.data?.planId || payload.plan_id || 'pro';
    const userEmail = payload.userEmail || payload.customer_email || payload.email || 'vic102393566@gmail.com';
    const paymentId = payload.paymentId || payload.id || `pay_${Date.now()}`;
    const amount = payload.amount || payload.data?.amount || 59.9;
    const currency = payload.currency || 'BRL';

    // Map gateway event type to subscription status
    let mappedStatus: 'ativa' | 'pendente' | 'cancelada' | 'expirada' = 'ativa';
    if (eventType === 'payment.failed' || eventType === 'invoice.payment_failed') {
      mappedStatus = 'pendente';
    } else if (eventType === 'subscription.canceled' || eventType === 'customer.subscription.deleted') {
      mappedStatus = 'cancelada';
    } else if (eventType === 'subscription.expired') {
      mappedStatus = 'expirada';
    } else if (eventType === 'payment.succeeded' || eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded') {
      mappedStatus = 'ativa';
    }

    // Validate planId
    const validPlan = ['basico', 'pro', 'premium'].includes(planId) ? planId : 'pro';

    // Update server-side subscription state
    serverSubscriptionState = {
      planId: validPlan,
      status: mappedStatus,
      startedAt: serverSubscriptionState.startedAt,
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastPaymentId: paymentId,
      paymentMethod: payload.paymentMethod || 'cartao',
      billingInterval: payload.billingInterval || 'mensal',
      updatedAt: new Date().toISOString(),
    };

    const recordedEvent: WebhookReceivedEvent = {
      id: `wh_evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      receivedAt: new Date().toISOString(),
      event: eventType,
      planId: validPlan,
      userEmail,
      status: mappedStatus,
      paymentId,
      amount,
      currency,
      rawPayload: payload,
    };

    receivedWebhookEvents.unshift(recordedEvent);
    // Keep max 30 recent webhook entries
    if (receivedWebhookEvents.length > 30) {
      receivedWebhookEvents.pop();
    }

    console.log(`[Webhook] Evento de pagamento recebido: ${eventType} -> Plano: ${validPlan}, Status: ${mappedStatus}`);

    return res.status(200).json({
      received: true,
      processedAt: new Date().toISOString(),
      subscription: serverSubscriptionState,
      message: `Webhook processado com sucesso. Assinatura do usuário atualizada para ${mappedStatus} no plano ${validPlan}.`,
    });
  } catch (err: any) {
    console.error('Erro ao processar webhook de pagamento:', err);
    return res.status(400).json({
      received: false,
      error: err.message || 'Formato de payload inválido',
    });
  }
});

/**
 * Public GET endpoint to inspect current server-side subscription state and recent webhooks
 */
app.get('/api/subscription/current', (req: Request, res: Response) => {
  return res.json({
    subscription: serverSubscriptionState,
    recentEvents: receivedWebhookEvents.slice(0, 5),
  });
});

/**
 * Endpoint to manually simulate or trigger a webhook payment confirmation (useful for UI testing & demos)
 */
app.post('/api/subscription/simulate-confirmation', (req: Request, res: Response) => {
  const { planId = 'pro', status = 'ativa', paymentMethod = 'cartao' } = req.body;
  const validPlan = ['basico', 'pro', 'premium'].includes(planId) ? planId : 'pro';

  serverSubscriptionState = {
    planId: validPlan,
    status: status,
    startedAt: serverSubscriptionState.startedAt,
    renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastPaymentId: `pay_sim_${Date.now()}`,
    paymentMethod,
    billingInterval: 'mensal',
    updatedAt: new Date().toISOString(),
  };

  return res.json({
    success: true,
    subscription: serverSubscriptionState,
    message: `Plano atualizado com sucesso para ${validPlan} com status ${status}.`,
  });
});

// ==========================================
// 4. REAL VIDEO PROCESSING ENGINE (FFMPEG)
// ==========================================

interface ActiveJob {
  process?: ChildProcess;
  cancelled: boolean;
  tempFiles: string[];
  progressPercent: number;
  currentPart: number;
  totalParts: number;
  status: string;
}

const activeProcessingJobs = new Map<string, ActiveJob>();

function formatFileSizeHelper(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDurationHelper(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = Math.floor(rounded % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

interface VideoProbeResult {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string;
  width?: number;
  height?: number;
  fileSizeBytes: number;
}

function probeVideoDetails(filePath: string): Promise<VideoProbeResult> {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return reject(new Error(`Arquivo de vídeo não encontrado no caminho: ${filePath}`));
    }
    const stat = fs.statSync(filePath);
    if (stat.size === 0) {
      return reject(new Error(`O arquivo de vídeo está vazio (0 bytes): ${filePath}`));
    }

    console.log(`[FFPROBE INICIADO] Analisando arquivo: ${filePath}`);
    const cmd = `ffprobe -v error -show_entries format=duration,size:stream=codec_name,codec_type,width,height -of json "${filePath}"`;
    exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
      if (err) {
        console.error(`[FFPROBE ERROR] Caminho: ${filePath} | Saída: ${stdout} | Erro: ${stderr || err.message}`);
        return reject(new Error(`ffprobe falhou ao ler arquivo: ${stderr || err.message}`));
      }

      try {
        const data = JSON.parse(stdout || '{}');
        const streams = Array.isArray(data.streams) ? data.streams : [];
        const videoStream = streams.find((s: any) => s.codec_type === 'video');
        const audioStream = streams.find((s: any) => s.codec_type === 'audio');

        let rawDuration = parseFloat(data.format?.duration);
        if (isNaN(rawDuration) || rawDuration <= 0) {
          rawDuration = parseFloat(videoStream?.duration);
        }

        if (!videoStream) {
          console.error(`[FFPROBE ERROR] Nenhum stream de vídeo encontrado em: ${filePath}`);
          return reject(new Error('Nenhum stream de vídeo válido encontrado no arquivo.'));
        }

        if (isNaN(rawDuration) || rawDuration <= 0) {
          console.error(`[FFPROBE ERROR] Duração inválida (${rawDuration}) para: ${filePath}`);
          return reject(new Error('Duração do vídeo não pôde ser identificada pelo ffprobe.'));
        }

        const result: VideoProbeResult = {
          duration: rawDuration,
          hasVideo: true,
          hasAudio: !!audioStream,
          videoCodec: videoStream.codec_name || 'h264',
          audioCodec: audioStream?.codec_name || 'nenhum',
          width: videoStream.width,
          height: videoStream.height,
          fileSizeBytes: stat.size,
        };

        console.log(`[FFPROBE FINALIZADO] Duração: ${result.duration.toFixed(2)}s | Codec vídeo: ${result.videoCodec} | Codec áudio: ${result.audioCodec} | Resolução: ${result.width || '?'}x${result.height || '?'}`);

        resolve(result);
      } catch (parseErr: any) {
        console.error(`[FFPROBE PARSE ERROR] Caminho: ${filePath} | Erro: ${parseErr.message}`);
        reject(new Error(`Erro ao interpretar saída do ffprobe: ${parseErr.message}`));
      }
    });
  });
}

/**
 * Diagnostic endpoint: checks if FFmpeg and FFprobe are available and functional
 */
app.get('/api/videos/ffmpeg-status', async (req: Request, res: Response) => {
  const getOutput = (cmd: string): Promise<{ success: boolean; output: string }> => {
    return new Promise((resolve) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, output: stderr || err.message });
        } else {
          resolve({ success: true, output: (stdout || stderr).trim() });
        }
      });
    });
  };

  const [whichFfmpeg, whichFfprobe, verFfmpeg, verFfprobe] = await Promise.all([
    getOutput('which ffmpeg'),
    getOutput('which ffprobe'),
    getOutput('ffmpeg -version'),
    getOutput('ffprobe -version'),
  ]);

  const ffmpegVersionLine = verFfmpeg.output.split('\n')[0] || '';
  const ffprobeVersionLine = verFfprobe.output.split('\n')[0] || '';

  return res.json({
    success: true,
    ffmpegAvailable: whichFfmpeg.success && verFfmpeg.success,
    ffprobeAvailable: whichFfprobe.success && verFfprobe.success,
    ffmpegPath: whichFfmpeg.success ? whichFfmpeg.output : null,
    ffprobePath: whichFfprobe.success ? whichFfprobe.output : null,
    ffmpegVersion: ffmpegVersionLine,
    ffprobeVersion: ffprobeVersionLine,
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
  });
});

/**
 * Endpoint to check current progress of an active split job
 */
app.get('/api/videos/split-progress/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = activeProcessingJobs.get(jobId);
  if (!job) {
    return res.json({
      success: true,
      found: false,
      progressPercent: 100,
      status: 'Concluído',
      cancelled: false,
    });
  }

  return res.json({
    success: true,
    found: true,
    progressPercent: job.progressPercent,
    currentPart: job.currentPart,
    totalParts: job.totalParts,
    status: job.status,
    cancelled: job.cancelled,
  });
});

/**
 * Endpoint to cancel an ongoing split job
 */
app.post('/api/videos/cancel-split/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = activeProcessingJobs.get(jobId);

  if (job) {
    job.cancelled = true;
    job.status = 'Cancelado pelo usuário';
    if (job.process && !job.process.killed) {
      try {
        job.process.kill('SIGKILL');
      } catch (err) {
        console.warn('Erro ao interromper processo ffmpeg:', err);
      }
    }

    // Clean up partial files
    for (const f of job.tempFiles) {
      try {
        if (fs.existsSync(f)) {
          fs.unlinkSync(f);
        }
      } catch (cleanErr) {
        console.warn('Erro ao limpar arquivo parcial:', cleanErr);
      }
    }

    activeProcessingJobs.delete(jobId);
    return res.json({ success: true, message: 'Processamento cancelado com sucesso.' });
  }

  return res.json({ success: true, message: 'Processo não encontrado ou já concluído.' });
});

/**
 * Endpoint to process and split a video using real FFmpeg
 */
app.post('/api/videos/split', upload.single('videoFile'), async (req: Request, res: Response) => {
  const jobId = req.body.jobId || `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  const userId = req.body.userId || 'user_vicente_1';
  const rawTitle = req.body.title || 'Vídeo';
  const cleanTitle = rawTitle.replace(/\.[^/.]+$/, '');

  // Validate chunkSeconds - do NOT silently default to 30s
  const rawChunk = req.body.chunkSeconds || req.body.duration;
  if (!rawChunk || isNaN(parseInt(rawChunk, 10)) || parseInt(rawChunk, 10) <= 0) {
    return res.status(400).json({
      success: false,
      error: 'A duração do corte não foi informada.',
    });
  }
  const requestedChunkSeconds = parseInt(rawChunk, 10);

  let inputFilePath: string | null = null;
  let isTempUpload = false;

  // 1. Identify input file path
  if (req.file) {
    inputFilePath = req.file.path;
    isTempUpload = true;
  } else if (req.body.videoUrl) {
    const rawUrl: string = req.body.videoUrl;
    if (rawUrl.startsWith('/media/')) {
      inputFilePath = path.resolve(__dirname, 'public', rawUrl.replace(/^\//, ''));
    } else if (rawUrl.includes('/media/')) {
      try {
        const parsedUrl = new URL(rawUrl, 'http://localhost');
        inputFilePath = path.resolve(__dirname, 'public', parsedUrl.pathname.replace(/^\//, ''));
      } catch {
        inputFilePath = path.resolve(__dirname, 'public', rawUrl.replace(/^\//, ''));
      }
    } else if (fs.existsSync(rawUrl)) {
      inputFilePath = rawUrl;
    }
  }

  // Fallback: If not found, check if it's one of the seed sample videos or sample-long
  if (!inputFilePath || !fs.existsSync(inputFilePath)) {
    const sourceVideoId = req.body.sourceVideoId || '';
    const sampleCandidate = path.resolve(mediaDir, 'samples', `${sourceVideoId}.mp4`);
    if (fs.existsSync(sampleCandidate)) {
      inputFilePath = sampleCandidate;
    } else {
      const longSample = path.resolve(mediaDir, 'samples', 'sample-long.mp4');
      const defaultSample = path.resolve(mediaDir, 'samples', 'vid-1.mp4');
      if (requestedChunkSeconds >= 180 && fs.existsSync(longSample)) {
        inputFilePath = longSample;
      } else if (fs.existsSync(defaultSample)) {
        inputFilePath = defaultSample;
      }
    }
  }

  if (!inputFilePath || !fs.existsSync(inputFilePath)) {
    return res.status(400).json({
      success: false,
      error: 'Arquivo de vídeo não encontrado no servidor. Envie o arquivo de vídeo para processamento.',
    });
  }

  try {
    // 2. Probe exact input video details using ffprobe
    const inputProbe = await probeVideoDetails(inputFilePath);

    console.log(`INPUT:
arquivo: ${inputFilePath}
tamanho: ${formatFileSizeHelper(inputProbe.fileSizeBytes)}
duração: ${inputProbe.duration.toFixed(2)}s
codec vídeo: ${inputProbe.videoCodec}
codec áudio: ${inputProbe.audioCodec}`);

    const totalDuration = inputProbe.duration;
    // Calculate parts (avoid creating micro-fraction parts for sub-second remainders)
    let estimatedParts = 1;
    if (totalDuration > requestedChunkSeconds) {
      const fullParts = Math.floor(totalDuration / requestedChunkSeconds);
      const remainder = totalDuration - (fullParts * requestedChunkSeconds);
      estimatedParts = remainder >= 2.0 ? fullParts + 1 : Math.max(1, fullParts);
    }

    // Initialize tracking job
    const currentJob: ActiveJob = {
      cancelled: false,
      tempFiles: isTempUpload ? [inputFilePath] : [],
      progressPercent: 5,
      currentPart: 1,
      totalParts: estimatedParts,
      status: `Iniciando corte de ${estimatedParts} parte(s) com FFmpeg...`,
    };
    activeProcessingJobs.set(jobId, currentJob);

    // Target directory for segments
    const jobOutputDir = path.resolve(mediaDir, 'cuts', userId, jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });

    try {
      fs.writeFileSync(path.resolve(jobOutputDir, '.split_meta.json'), JSON.stringify({
        sourceVideoId: req.body.sourceVideoId || '',
        jobId,
        userId,
        originalVideoUrl: req.body.videoUrl || '',
        createdAt: new Date().toISOString(),
      }));
    } catch (metaErr: any) {
      console.warn('Aviso ao registrar metadados de corte:', metaErr.message);
    }

    const generatedParts: any[] = [];
    const nowTime = Date.now();

    // 3. Process each segment sequentially with robust FFmpeg command
    for (let partIndex = 1; partIndex <= estimatedParts; partIndex++) {
      if (currentJob.cancelled) {
        throw new Error('Processamento cancelado pelo usuário');
      }

      const startSec = (partIndex - 1) * requestedChunkSeconds;
      const partDuration = Math.min(requestedChunkSeconds, totalDuration - startSec);

      console.log(`CUT:
opção selecionada: ${req.body.selectedOption || `${requestedChunkSeconds}s`}
segundos recebidos: ${requestedChunkSeconds}
segundos usados pelo FFmpeg: ${partDuration}`);

      currentJob.currentPart = partIndex;
      currentJob.progressPercent = Math.min(94, Math.round(((partIndex - 0.5) / estimatedParts) * 90) + 5);
      currentJob.status = `Renderizando Parte ${partIndex} de ${estimatedParts} (${formatDurationHelper(startSec)} a ${formatDurationHelper(startSec + partDuration)})...`;

      const outVideoPath = path.resolve(jobOutputDir, `part_${partIndex}.mp4`);
      const outThumbPath = path.resolve(jobOutputDir, `thumb_${partIndex}.jpg`);
      currentJob.tempFiles.push(outVideoPath, outThumbPath);

      // Safe seek after input, exact flags specified by user:
      // -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -movflags +faststart
      const ffmpegCmd = `ffmpeg -y -i "${inputFilePath}" -ss ${startSec} -t ${partDuration} -c:v libx264 -preset veryfast -pix_fmt yuv420p -c:a aac -b:a 128k -ar 48000 -movflags +faststart "${outVideoPath}"`;

      console.log(`[COMANDO FINAL EXECUTADO]: ${ffmpegCmd}`);

      await new Promise<void>((resolve, reject) => {
        const child = exec(ffmpegCmd, (err, stdout, stderr) => {
          if (err) {
            if (currentJob.cancelled) {
              return reject(new Error('Processamento cancelado'));
            }
            console.error(`Erro no FFmpeg na parte ${partIndex}:`, stderr || err.message);
            return reject(new Error(`Falha no FFmpeg ao gerar parte ${partIndex}: ${stderr || err.message}`));
          }
          resolve();
        });

        currentJob.process = child;
      });

      if (currentJob.cancelled) {
        throw new Error('Processamento cancelado pelo usuário');
      }

      // 4. Extract thumbnail directly from the generated cut video (NOT the original video)
      const thumbSeek = Math.min(0.5, partDuration > 1 ? 0.5 : 0);
      const thumbCmd = `ffmpeg -y -i "${outVideoPath}" -ss ${thumbSeek} -vframes 1 -q:v 2 "${outThumbPath}"`;
      await new Promise<void>((resolve) => {
        exec(thumbCmd, (err, stdout, stderr) => {
          if (err) {
            console.warn(`Aviso: falha ao extrair miniatura da parte ${partIndex}:`, stderr || err.message);
          }
          resolve();
        });
      });

      // 5. POST-GENERATION VALIDATION WITH FFPROBE
      let partProbe: VideoProbeResult;
      try {
        partProbe = await probeVideoDetails(outVideoPath);
        if (!partProbe.hasVideo) {
          throw new Error('Arquivo cortado gerado sem stream de vídeo');
        }
        if (partProbe.duration <= 0 || isNaN(partProbe.duration)) {
          throw new Error('Duração do arquivo cortado é inválida');
        }
      } catch (valErr: any) {
        console.error(`[VALIDAÇÃO FALHOU] Parte ${partIndex} inválida:`, valErr.message);
        if (fs.existsSync(outVideoPath)) fs.unlinkSync(outVideoPath);
        if (fs.existsSync(outThumbPath)) fs.unlinkSync(outThumbPath);
        throw new Error(`Validação pós-corte falhou na parte ${partIndex}: ${valErr.message}`);
      }

      // Log OUTPUT specs as requested
      console.log(`OUTPUT:
arquivo: ${outVideoPath}
duração: ${partProbe.duration.toFixed(2)}s
codec vídeo: ${partProbe.videoCodec}
codec áudio: ${partProbe.audioCodec}
tamanho: ${formatFileSizeHelper(partProbe.fileSizeBytes)}`);

      const partItem = {
        id: `vid-part-${nowTime}-${partIndex}`,
        userId: userId,
        title: `${cleanTitle} - Parte ${partIndex}`,
        thumbnail: fs.existsSync(outThumbPath)
          ? `/media/cuts/${userId}/${jobId}/thumb_${partIndex}.jpg`
          : req.body.thumbnail || '',
        videoUrl: `/media/cuts/${userId}/${jobId}/part_${partIndex}.mp4`,
        duration: formatDurationHelper(partProbe.duration),
        durationSeconds: Math.round(partProbe.duration),
        uploadedAt: 'Hoje, corte automático',
        createdAt: new Date().toISOString(),
        viewsTotal: 0,
        publishedCount: 0,
        status: 'disponivel',
        fileSize: formatFileSizeHelper(partProbe.fileSizeBytes),
        sizeBytes: partProbe.fileSizeBytes,
        uploadedBy: req.body.uploadedBy || 'vic102393566@gmail.com',
        storageProvider: 'Clipo Video Engine (FFmpeg)',
      };

      generatedParts.push(partItem);
    }

    currentJob.progressPercent = 100;
    currentJob.status = 'Cortes concluídos e validados com sucesso!';

    setTimeout(() => {
      activeProcessingJobs.delete(jobId);
    }, 60000);

    return res.json({
      success: true,
      jobId,
      totalDuration,
      chunkSeconds: requestedChunkSeconds,
      parts: generatedParts,
    });
  } catch (procErr: any) {
    console.error('Erro no processamento de corte de vídeo:', procErr);
    activeProcessingJobs.delete(jobId);

    return res.status(500).json({
      success: false,
      error: procErr.message || 'Falha ao processar vídeo no servidor.',
    });
  }
});

/**
 * Endpoint to upload a video directly to the backend media storage
 */
app.post('/api/videos/upload', (req: Request, res: Response, next) => {
  console.log('[UPLOAD INICIADO] Requisição recebida em /api/videos/upload');
  upload.single('videoFile')(req, res, (err) => {
    if (err) {
      console.error('[ERRO NO UPLOAD - MULTER]:', err.message);
      return res.status(400).json({ success: false, error: `Falha no envio do arquivo: ${err.message}` });
    }
    next();
  });
}, async (req: Request, res: Response) => {
  if (!req.file) {
    console.error('[ERRO NO UPLOAD]: Nenhum arquivo anexado na requisição.');
    return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' });
  }

  const userId = req.body.userId || 'user_vicente_1';
  const uploadedPath = req.file.path;
  const fileName = req.file.filename;
  const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, '');

  console.log(`[UPLOAD RECEBIDO] Arquivo: ${req.file.originalname}`);
  console.log(`[ARQUIVO SALVO] Caminho: ${uploadedPath}`);
  console.log(`[TAMANHO DO ARQUIVO] ${formatFileSizeHelper(req.file.size)} (${req.file.size} bytes)`);

  try {
    // 1. Confirm file exists and size > 0
    if (!fs.existsSync(uploadedPath) || req.file.size === 0) {
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      return res.status(400).json({ success: false, error: 'Arquivo recebido vazio ou incompleto.' });
    }

    // 2. Validate with ffprobe: checks video stream and duration
    const probe = await probeVideoDetails(uploadedPath);

    // 2.1 Enforce plan duration limits:
    // Básico: até 30 minutos (1800s)
    // Pro: até 2 horas (7200s) para podcasts, lives e aulas
    // Premium: até 4 horas (14400s)
    const userPlanTier = (req.body.planTier || req.body.planId || 'pro').toLowerCase();
    if (userPlanTier === 'basico' && probe.duration > 1800) {
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      const hours = (probe.duration / 3600).toFixed(1);
      return res.status(400).json({
        success: false,
        error: `A duração deste vídeo (${hours}h / ${formatDurationHelper(probe.duration)}) excede o limite de 30 minutos do plano Básico. Faça upgrade para o plano Pro para processar vídeos de até 2 horas (podcasts, lives e aulas).`,
      });
    } else if (userPlanTier === 'pro' && probe.duration > 7200) {
      if (fs.existsSync(uploadedPath)) fs.unlinkSync(uploadedPath);
      const hours = (probe.duration / 3600).toFixed(1);
      return res.status(400).json({
        success: false,
        error: `A duração deste vídeo (${hours}h / ${formatDurationHelper(probe.duration)}) excede o limite de 2 horas do plano Pro. Para conteúdos ainda mais longos, faça upgrade para o plano Premium (até 4 horas).`,
      });
    }

    // 3. Extract thumbnail frame from uploaded video
    const thumbFilename = `thumb_${Date.now()}.jpg`;
    const thumbPath = path.resolve(uploadsDir, thumbFilename);
    const thumbSeek = Math.min(1.0, probe.duration > 2 ? 1.0 : probe.duration / 2);

    await new Promise<void>((resolve) => {
      exec(`ffmpeg -y -i "${uploadedPath}" -ss ${thumbSeek} -vframes 1 -q:v 2 "${thumbPath}"`, { timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          console.warn('Aviso: erro ao extrair frame de thumbnail:', stderr || err.message);
        }
        resolve();
      });
    });

    const sizeBytes = req.file.size;
    const videoItem = {
      id: `vid-${Date.now()}`,
      userId,
      title,
      description: req.body.description || '',
      hashtags: Array.isArray(req.body.hashtags) ? req.body.hashtags : [],
      thumbnail: fs.existsSync(thumbPath) ? `/media/uploads/${thumbFilename}` : '',
      videoUrl: `/media/uploads/${fileName}`,
      duration: formatDurationHelper(probe.duration),
      durationSeconds: Math.round(probe.duration),
      uploadedAt: 'Hoje, agora há pouco',
      createdAt: new Date().toISOString(),
      viewsTotal: 0,
      publishedCount: 0,
      status: 'disponivel',
      fileSize: formatFileSizeHelper(sizeBytes),
      sizeBytes,
      uploadedBy: req.body.uploadedBy || 'vic102393566@gmail.com',
      storageProvider: 'Clipo Video Engine (FFmpeg)',
    };

    console.log(`[UPLOAD CONCLUÍDO] Vídeo válido salvo: ${videoItem.id} | Duração: ${videoItem.duration} (${videoItem.durationSeconds}s) | Tamanho: ${videoItem.fileSize}`);

    return res.json({ success: true, video: videoItem });
  } catch (err: any) {
    console.error('[ERRO NO UPLOAD]: Falha de validação ffprobe:', err.message);
    if (fs.existsSync(uploadedPath)) {
      try {
        fs.unlinkSync(uploadedPath);
      } catch {}
    }
    return res.status(400).json({
      success: false,
      error: `Arquivo de vídeo inválido ou corrompido: ${err.message}`,
    });
  }
});

/**
 * Persistent store for video metadata updates (Title, Description, Hashtags)
 */
const savedVideoMetadataStore = new Map<string, { title?: string; description?: string; hashtags?: string[]; updatedAt: string }>();

// ==========================================
// ROTA GET /api/storage/usage
// Retorna o tamanho real dos arquivos em media/uploads e media/cuts
// ==========================================
app.get(['/api/storage/usage', '/api/storage'], (req: Request, res: Response) => {
  let uploadsBytes = 0;
  let cutsBytes = 0;
  let uploadsFilesCount = 0;
  let cutsFilesCount = 0;

  const countDir = (dirPath: string): { bytes: number; count: number } => {
    let bytes = 0;
    let count = 0;
    if (!fs.existsSync(dirPath)) return { bytes, count };
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.resolve(dirPath, entry.name);
        if (entry.isDirectory()) {
          const sub = countDir(fullPath);
          bytes += sub.bytes;
          count += sub.count;
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);
            bytes += stat.size;
            count += 1;
          } catch {}
        }
      }
    } catch {}
    return { bytes, count };
  };

  const uploadsInfo = countDir(uploadsDir);
  const cutsInfo = countDir(path.resolve(mediaDir, 'cuts'));

  uploadsBytes = uploadsInfo.bytes;
  uploadsFilesCount = uploadsInfo.count;
  cutsBytes = cutsInfo.bytes;
  cutsFilesCount = cutsInfo.count;

  const totalUsedBytes = uploadsBytes + cutsBytes;
  const totalFilesCount = uploadsFilesCount + cutsFilesCount;

  return res.json({
    success: true,
    totalUsedBytes,
    uploadsBytes,
    cutsBytes,
    totalFilesCount,
    usedFormatted: totalUsedBytes === 0 ? '0,0 GB' : totalUsedBytes < 100 * 1024 * 1024 ? `${(totalUsedBytes / (1024 * 1024)).toFixed(1)} MB` : `${(totalUsedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
  });
});

// ==========================================
// ROTA DELETE /api/videos/:id
// Exclui o arquivo original correspondente e seus cortes no servidor
// ==========================================
app.delete('/api/videos/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  const videoUrl: string = (req.body?.videoUrl || req.query?.videoUrl || '') as string;
  const thumbnail: string = (req.body?.thumbnail || req.query?.thumbnail || '') as string;
  const userId: string = (req.body?.userId || req.query?.userId || 'user_vicente_1') as string;
  const relatedCutUrls: string[] = Array.isArray(req.body?.relatedCutUrls) ? req.body.relatedCutUrls : [];
  const relatedThumbnails: string[] = Array.isArray(req.body?.relatedThumbnails) ? req.body.relatedThumbnails : [];

  console.log(`[DELETE /api/videos/:id] Solicitada exclusão para vídeo: ${id} | URL: ${videoUrl}`);

  const deletedFiles: string[] = [];

  // Helper para excluir arquivo com segurança sem tocar em amostras /media/samples/
  const safeDelete = (rawPathOrUrl?: string | null): boolean => {
    if (!rawPathOrUrl) return false;
    try {
      let targetPath: string | null = null;

      // 1. Se já for caminho absoluto no disco e existir
      if (path.isAbsolute(rawPathOrUrl) && fs.existsSync(rawPathOrUrl)) {
        targetPath = rawPathOrUrl;
      } else {
        // 2. Extrai a porção relativa a /media/
        const mediaIdx = rawPathOrUrl.indexOf('/media/');
        if (mediaIdx !== -1) {
          const subPath = rawPathOrUrl.substring(mediaIdx + 1); // "media/..."
          targetPath = path.resolve(__dirname, 'public', subPath);
        } else if (rawPathOrUrl.startsWith('media/')) {
          targetPath = path.resolve(__dirname, 'public', rawPathOrUrl);
        } else {
          targetPath = path.resolve(__dirname, 'public', rawPathOrUrl.replace(/^\//, ''));
        }
      }

      if (targetPath) {
        // Nunca excluir vídeos de amostra / template em media/samples/
        const relativeSamples = path.relative(path.resolve(__dirname, 'public/media/samples'), targetPath);
        if (!relativeSamples.startsWith('..') && !path.isAbsolute(relativeSamples)) {
          return false;
        }

        if (fs.existsSync(targetPath)) {
          const stat = fs.statSync(targetPath);
          if (stat.isFile()) {
            fs.unlinkSync(targetPath);
            deletedFiles.push(targetPath);
            console.log(`[ARQUIVO EXCLUÍDO]: ${targetPath}`);

            // Se o arquivo estava em uma subpasta de cortes (media/cuts/userId/jobId), verifica se a pasta ficou vazia
            const parentDir = path.dirname(targetPath);
            const cutsDir = path.resolve(mediaDir, 'cuts');
            if (parentDir.startsWith(cutsDir) && parentDir !== cutsDir && fs.existsSync(parentDir)) {
              try {
                const remaining = fs.readdirSync(parentDir).filter((f) => !f.startsWith('.'));
                if (remaining.length === 0) {
                  fs.rmSync(parentDir, { recursive: true, force: true });
                  console.log(`[DIRETÓRIO DE CORTES VAZIO REMOVIDO]: ${parentDir}`);
                }
              } catch {}
            }
            return true;
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AVISO AO EXCLUIR ARQUIVO]: ${rawPathOrUrl} - ${err.message}`);
    }
    return false;
  };

  // 1. Excluir o arquivo original do vídeo e a miniatura
  safeDelete(videoUrl);
  safeDelete(thumbnail);

  // 2. Excluir cortes e miniaturas passados explicitamente
  for (const cutUrl of relatedCutUrls) {
    safeDelete(cutUrl);
  }
  for (const thumbUrl of relatedThumbnails) {
    safeDelete(thumbUrl);
  }

  // 3. Procurar arquivos em media/uploads que contenham o ID ou o timestamp
  try {
    if (fs.existsSync(uploadsDir) && id) {
      const files = fs.readdirSync(uploadsDir);
      const cleanNumericId = id.replace(/[^0-9]/g, '');
      for (const f of files) {
        if (f.includes(id) || (cleanNumericId.length >= 6 && f.includes(cleanNumericId))) {
          safeDelete(path.resolve(uploadsDir, f));
        }
      }
    }
  } catch (err: any) {
    console.warn('[AVISO SCAN UPLOADS]:', err.message);
  }

  // 4. Procurar e remover pastas de cortes em media/cuts vinculadas a este vídeo original
  try {
    const cutsRootDir = path.resolve(mediaDir, 'cuts');
    const cleanNumericId = id.replace(/[^0-9]/g, '');
    if (fs.existsSync(cutsRootDir)) {
      const scanDir = (dirPath: string) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.resolve(dirPath, entry.name);
          if (entry.isDirectory()) {
            const metaPath = path.resolve(fullPath, '.split_meta.json');
            if (fs.existsSync(metaPath)) {
              try {
                const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
                if (meta.sourceVideoId === id || (videoUrl && meta.originalVideoUrl === videoUrl)) {
                  fs.rmSync(fullPath, { recursive: true, force: true });
                  deletedFiles.push(fullPath);
                  console.log(`[PASTA DE CORTES VINCULADA EXCLUÍDA]: ${fullPath}`);
                  continue;
                }
              } catch {}
            }
            if (entry.name.includes(id) || (cleanNumericId.length >= 6 && entry.name.includes(cleanNumericId))) {
              fs.rmSync(fullPath, { recursive: true, force: true });
              deletedFiles.push(fullPath);
              console.log(`[PASTA DE CORTES POR ID EXCLUÍDA]: ${fullPath}`);
              continue;
            }
            scanDir(fullPath);
          }
        }
      };
      scanDir(cutsRootDir);
    }
  } catch (err: any) {
    console.warn('[AVISO SCAN CORTES]:', err.message);
  }

  // 5. Limpar do mapa de metadados em memória se existir
  savedVideoMetadataStore.delete(id);

  console.log(`[DELETE /api/videos/:id CONCLUÍDO] ID: ${id} | ${deletedFiles.length} item(ns) removido(s).`);

  return res.json({
    success: true,
    message: 'Vídeo e arquivos relacionados excluídos com sucesso.',
    id,
    deletedFilesCount: deletedFiles.length,
  });
});

// Rota para salvar metadados do vídeo (POST/PUT/PATCH)
app.post(['/api/videos/save', '/api/videos/:id/save', '/api/videos/:id'], (req: Request, res: Response) => {
  const videoId = req.params.id || req.body.id || req.body.videoId;
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'ID do vídeo não informado.' });
  }

  const { title, description, hashtags } = req.body;
  const existing = savedVideoMetadataStore.get(videoId) || { updatedAt: new Date().toISOString() };

  const parsedHashtags = Array.isArray(hashtags)
    ? hashtags
    : typeof hashtags === 'string'
    ? hashtags.split(/[\s,]+/).filter(Boolean).map((t: string) => (t.startsWith('#') ? t : `#${t}`))
    : existing.hashtags;

  const updated = {
    ...existing,
    ...(title !== undefined ? { title: String(title).trim() } : {}),
    ...(description !== undefined ? { description: String(description).trim() } : {}),
    ...(parsedHashtags !== undefined ? { hashtags: parsedHashtags } : {}),
    updatedAt: new Date().toISOString(),
  };

  savedVideoMetadataStore.set(videoId, updated);
  console.log(`[VIDEO SALVO COM SUCESSO] ID: ${videoId} | Título: "${updated.title}" | Descrição: "${updated.description}" | Hashtags: ${JSON.stringify(updated.hashtags)}`);

  return res.json({
    success: true,
    message: 'Vídeo atualizado com sucesso.',
    video: {
      id: videoId,
      ...updated,
    },
  });
});

app.put('/api/videos/:id', (req: Request, res: Response) => {
  const videoId = req.params.id;
  const { title, description, hashtags } = req.body;
  const existing = savedVideoMetadataStore.get(videoId) || { updatedAt: new Date().toISOString() };

  const parsedHashtags = Array.isArray(hashtags)
    ? hashtags
    : typeof hashtags === 'string'
    ? hashtags.split(/[\s,]+/).filter(Boolean).map((t: string) => (t.startsWith('#') ? t : `#${t}`))
    : existing.hashtags;

  const updated = {
    ...existing,
    ...(title !== undefined ? { title: String(title).trim() } : {}),
    ...(description !== undefined ? { description: String(description).trim() } : {}),
    ...(parsedHashtags !== undefined ? { hashtags: parsedHashtags } : {}),
    updatedAt: new Date().toISOString(),
  };

  savedVideoMetadataStore.set(videoId, updated);
  return res.json({
    success: true,
    message: 'Vídeo atualizado com sucesso.',
    video: {
      id: videoId,
      ...updated,
    },
  });
});

// ==========================================
// 5. AI METADATA GENERATION ENGINE (GEMINI)
// ==========================================

/**
 * Endpoint to generate publication metadata (title, description, hashtags, CTA)
 * using Google Gemini with structured outputs and real video context.
 */
app.post('/api/ai/generate-metadata', async (req: Request, res: Response) => {
  const {
    videoId = '',
    title = '',
    duration = '',
    thumbnail = '',
    videoUrl = '',
    platforms = ['tiktok', 'instagram'],
    model = 'gemini-3.8-flash',
    promptContext = '',
    tone = 'viral', // 'viral', 'educativo', 'persuasivo', 'minimalista'
  } = req.body;

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'GEMINI_API_KEY não configurada no servidor. Conecte sua chave para habilitar a IA.',
    });
  }

  // Validate allowed Gemini models per @google/genai guidelines
  const allowedModels = [
    'gemini-3.8-flash',
    'gemini-flash-latest',
    'gemini-3.1-flash-lite',
    'gemini-3.1-pro-preview',
  ];
  const selectedModel = allowedModels.includes(model) ? model : 'gemini-3.8-flash';

  try {
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const parts: any[] = [];
    let hasImageContext = false;

    // Check if thumbnail is a local file on the server (e.g. /media/cuts/... or /media/samples/...)
    if (thumbnail && thumbnail.startsWith('/media/')) {
      const localImagePath = path.resolve(__dirname, 'public', thumbnail.replace(/^\//, ''));
      if (fs.existsSync(localImagePath)) {
        try {
          const imageBuffer = fs.readFileSync(localImagePath);
          const mime = localImagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
          parts.push({
            inlineData: {
              data: imageBuffer.toString('base64'),
              mimeType: mime,
            },
          });
          hasImageContext = true;
        } catch (imgErr) {
          console.warn('Erro ao carregar miniatura local para IA:', imgErr);
        }
      }
    }

    const platformLabels = Array.isArray(platforms) && platforms.length > 0
      ? platforms.join(', ')
      : 'TikTok, Instagram Reels, YouTube Shorts';

    const toneInstruction = {
      viral: 'com alto apelo de retenção, gancho irresistível e curiosidade imediata',
      educativo: 'didático, claro, agregador de valor prático e autoridade',
      persuasivo: 'focado em conversão, benefício do produto e engajamento ativo',
      minimalista: 'direto ao ponto, sofisticado, conciso e elegante',
    }[tone as string] || 'viral e dinâmico';

    const promptText = `Analise atentamente as informações reais disponíveis sobre este vídeo:
- Título ou tema base: "${title || 'Sem título'}"
- Duração do vídeo: ${duration || 'Não especificada'}
- Redes sociais de publicação: ${platformLabels}
- Tom de comunicação desejado: ${toneInstruction}
${hasImageContext ? '- Imagem anexada: Frame real/miniatura capturada do vídeo.' : ''}
${promptContext ? `- Observação do criador: "${promptContext}"` : ''}

Com base EXCLUSIVAMENTE nas informações acima, crie o conteúdo ideal para publicação:
1. Título (title): Gancho poderoso nos primeiros 3 segundos, direto e atraente (máximo 60-70 caracteres).
2. Descrição (description): Texto de 2 a 4 frases que resume o conteúdo, gera curiosidade e destaca o benefício de assistir.
3. Hashtags (hashtags): Lista de 5 a 8 hashtags altamente relevantes para o nicho, com o símbolo # no início de cada uma.
4. Chamada para o público (callToAction): Uma frase de Call To Action (CTA) estimulando a audiência a comentar, salvar, compartilhar ou seguir o criador.

Responda em Português do Brasil no formato JSON estruturado.`;

    parts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts },
      config: {
        systemInstruction: `Você é um estrategista de conteúdo sênior e copywriter especialista em vídeos verticais curtos para TikTok, Instagram Reels, YouTube Shorts e LinkedIn.
Você nunca inventa fatos que contradigam os metadados do vídeo. Toda a sugestão deve ser prática, atual e pronta para colar na rede social.`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Título curto e atrativo para o vídeo nas redes.',
            },
            description: {
              type: Type.STRING,
              description: 'Descrição persuasiva e estruturada para a publicação.',
            },
            hashtags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Lista de hashtags estratégicas começando com #.',
            },
            callToAction: {
              type: Type.STRING,
              description: 'Chamada para ação direcionando engajamento do público.',
            },
          },
          required: ['title', 'description', 'hashtags', 'callToAction'],
        },
      },
    });

    const parsedJson = JSON.parse(response.text?.trim() || '{}');

    // Clean up hashtags formatting
    const rawHashtags = Array.isArray(parsedJson.hashtags) ? parsedJson.hashtags : [];
    const cleanedHashtags = rawHashtags.map((h: string) => {
      const clean = h.trim();
      return clean.startsWith('#') ? clean : `#${clean}`;
    });

    return res.json({
      success: true,
      data: {
        title: parsedJson.title || title,
        description: parsedJson.description || '',
        hashtags: cleanedHashtags.length > 0 ? cleanedHashtags : ['#clipo', '#shorts', '#viral'],
        callToAction: parsedJson.callToAction || 'Salve este vídeo para não esquecer e comente sua opinião!',
        modelUsed: selectedModel,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Erro na API Gemini ao gerar metadados:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Falha ao gerar dados com IA. Tente novamente.',
    });
  }
});

// Ensure ANY unhandled request to /api/* returns JSON, never HTML
app.all('/api/*', (req: Request, res: Response) => {
  console.warn(`[API 404] Rota não encontrada: ${req.method} ${req.originalUrl}`);
  return res.status(404).json({
    success: false,
    error: `Rota da API não encontrada: ${req.method} ${req.originalUrl}`,
  });
});

// ==========================================
// 4. VITE MIDDLEWARE SETUP
// ==========================================
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Clipo Server rodando na porta ${PORT} [OAuth & API Ready]`);
  });
}

startServer();
