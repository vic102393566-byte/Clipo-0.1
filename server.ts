import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { exec, ChildProcess } from 'child_process';
import multer from 'multer';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createRequire } from 'module';
import type * as WebPushModule from 'web-push';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof WebPushModule;

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
  platform: 'youtube' | 'instagram' | 'tiktok' | 'linkedin';
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
// ROTA GET /api/health
// Verificação de status e integridade do backend (Vercel & Local)
// ==========================================
app.get('/api/health', (req: Request, res: Response) => {
  return res.status(200).json({ ok: true });
});

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
  const liConn = userSocialConnections.get(`${userId}:linkedin`);

  const isYtConfigured = Boolean(process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID);
  const isIgConfigured = Boolean(process.env.INSTAGRAM_CLIENT_ID || process.env.META_APP_ID);
  const isTtConfigured = Boolean(process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY);
  const isLiConfigured = Boolean(process.env.LINKEDIN_CLIENT_ID);

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
    linkedin: {
      connected: liConn?.connected ?? false,
      configured: isLiConfigured,
      connectedAt: liConn?.connectedAt,
      account: liConn?.connected ? liConn.account : null,
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

// ------------------------------------------
// 1.4 LINKEDIN (Official OAuth 2.0 API)
// ------------------------------------------

app.get('/api/auth/linkedin/url', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${baseAppUrl}/api/auth/linkedin/callback`;
  const scope = 'openid profile w_member_social';
  const state = encodeOAuthState(userId, 'linkedin');

  if (!clientId) {
    return res.status(200).json({
      configured: false,
      message: 'LINKEDIN_CLIENT_ID não configurada no ambiente.',
      missingKeys: ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
      redirectUri,
      scopes: scope,
      setupUrl: 'https://www.linkedin.com/developers/apps',
    });
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
  });

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  return res.json({
    configured: true,
    url: authUrl,
    redirectUri,
    state,
  });
});

app.get(['/api/auth/linkedin/callback', '/api/auth/linkedin/callback/'], async (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;
  const { userId } = decodeOAuthState(state);

  if (error) {
    return res.send(renderOAuthErrorPage('LinkedIn', 'linkedin', String(error_description || error)));
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const baseAppUrl = getBaseAppUrl();
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || `${baseAppUrl}/api/auth/linkedin/callback`;

  try {
    if (code && clientId && clientSecret) {
      const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });

      const tokenData = await tokenRes.json();
      if (tokenData.access_token) {
        let memberId = 'li_member';
        let memberName = 'Criador LinkedIn';
        let memberHandle = 'linkedin.com/in/creator';
        let avatarUrl = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&auto=format&fit=crop&q=80';

        try {
          const userInfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          });
          const userInfo = await userInfoRes.json();
          if (userInfo.sub) {
            memberId = userInfo.sub;
            memberName = userInfo.name || memberName;
            memberHandle = userInfo.email || `@${memberName.toLowerCase().replace(/\s+/g, '-')}`;
            avatarUrl = userInfo.picture || avatarUrl;
          }
        } catch (profileErr) {
          console.warn('Erro ao obter perfil LinkedIn:', profileErr);
        }

        const accountData: SocialAccountData = {
          id: memberId,
          name: memberName,
          handle: memberHandle,
          avatarUrl,
          followerCount: 0,
          followersFormatted: '0',
          scope: tokenData.scope,
        };

        userSocialConnections.set(`${userId}:linkedin`, {
          userId,
          platform: 'linkedin',
          connected: true,
          connectedAt: new Date().toISOString(),
          account: accountData,
          tokens: {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresIn: tokenData.expires_in,
            expiresAt: Date.now() + (tokenData.expires_in || 5184000) * 1000,
            scope: tokenData.scope,
          },
        });
        saveSocialConnectionsToDisk();

        return res.send(renderOAuthSuccessPage('LinkedIn', 'linkedin', accountData));
      }
    }
  } catch (err: any) {
    console.error('Erro na troca de código LinkedIn:', err);
    return res.send(renderOAuthErrorPage('LinkedIn', 'linkedin', err.message || 'Erro na troca de código OAuth.'));
  }

  return res.send(renderOAuthErrorPage('LinkedIn', 'linkedin', 'Código ou credenciais inválidas.'));
});

app.post('/api/auth/linkedin/disconnect', (req: Request, res: Response) => {
  const userId = String(req.body.userId || 'default_user');
  userSocialConnections.delete(`${userId}:linkedin`);
  saveSocialConnectionsToDisk();
  return res.json({ success: true, message: 'Conta do LinkedIn desconectada com sucesso.' });
});

// ==========================================
// 2. WEB PUSH NOTIFICATIONS & MULTI-PLATFORM PUBLISHING
// ==========================================

interface StoredPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId: string;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PublishNotificationRecord {
  id: string;
  userId: string;
  type: 'publish_success' | 'publish_failure' | 'push_test';
  title: string;
  body: string;
  publicationId?: string;
  platforms: Array<'tiktok' | 'instagram' | 'youtube' | 'linkedin'>;
  platformResults?: Array<{
    platform: 'tiktok' | 'instagram' | 'youtube' | 'linkedin';
    success: boolean;
    postId?: string;
    postUrl?: string;
    error?: string;
    publishedAt?: string;
  }>;
  createdAt: string;
}

interface ServerScheduledPublication {
  id: string;
  userId: string;
  videoId?: string;
  videoUrl?: string;
  storagePath?: string;
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  scheduledTime: string;
  scheduledDateLabel: string;
  dateISO?: string;
  platforms: Array<'tiktok' | 'instagram' | 'youtube' | 'linkedin'>;
  status: 'agendado' | 'processando' | 'publicado' | 'falhou' | 'cancelado';
  aspectRatio?: '9:16' | '16:9' | '1:1';
  fileSize?: string;
  hashtags?: string[];
  callToAction?: string;
  errorMessage?: string;
  platformResults?: PublishNotificationRecord['platformResults'];
  publishedAt?: string;
  pushNotified?: boolean;
  updatedAt?: string;
}

const VAPID_KEYS_FILE = path.resolve(TOKENS_STORE_DIR, 'vapid_keys.json');
const PUSH_SUBS_FILE = path.resolve(TOKENS_STORE_DIR, 'push_subscriptions.json');
const NOTIFICATIONS_LOG_FILE = path.resolve(TOKENS_STORE_DIR, 'notifications_log.json');
const SCHEDULED_JOBS_FILE = path.resolve(TOKENS_STORE_DIR, 'scheduled_jobs.json');

function ensureStorageDir() {
  if (!fs.existsSync(TOKENS_STORE_DIR)) {
    fs.mkdirSync(TOKENS_STORE_DIR, { recursive: true });
  }
}

function getOrCreateVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
  const subject = process.env.VAPID_SUBJECT || 'mailto:notificacoes@clipo.app';
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject,
    };
  }

  ensureStorageDir();
  try {
    if (fs.existsSync(VAPID_KEYS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf-8'));
      if (saved?.publicKey && saved?.privateKey) {
        return { publicKey: saved.publicKey, privateKey: saved.privateKey, subject };
      }
    }
  } catch (err) {
    console.warn('[Push] Erro ao ler VAPID keys do disco:', err);
  }

  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(generated, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Push] Erro ao persistir VAPID keys:', err);
  }
  return { publicKey: generated.publicKey, privateKey: generated.privateKey, subject };
}

const vapidConfig = getOrCreateVapidKeys();
webpush.setVapidDetails(vapidConfig.subject, vapidConfig.publicKey, vapidConfig.privateKey);

const userPushSubscriptions = new Map<string, StoredPushSubscription[]>();
const userNotificationsLog = new Map<string, PublishNotificationRecord[]>();
const userScheduledJobs = new Map<string, ServerScheduledPublication[]>();
const sseClientsByUser = new Map<string, Set<Response>>();

function loadPushSubscriptionsFromDisk() {
  try {
    if (fs.existsSync(PUSH_SUBS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PUSH_SUBS_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        for (const [uid, subs] of Object.entries(parsed)) {
          if (Array.isArray(subs)) {
            userPushSubscriptions.set(uid, subs as StoredPushSubscription[]);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Push] Erro ao carregar assinaturas:', err);
  }
}

function savePushSubscriptionsToDisk() {
  try {
    ensureStorageDir();
    const obj: Record<string, StoredPushSubscription[]> = {};
    for (const [uid, subs] of userPushSubscriptions.entries()) {
      obj[uid] = subs;
    }
    fs.writeFileSync(PUSH_SUBS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Push] Erro ao salvar assinaturas:', err);
  }
}

function loadNotificationsLogFromDisk() {
  try {
    if (fs.existsSync(NOTIFICATIONS_LOG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(NOTIFICATIONS_LOG_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        for (const [uid, list] of Object.entries(parsed)) {
          if (Array.isArray(list)) {
            userNotificationsLog.set(uid, list as PublishNotificationRecord[]);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Push] Erro ao carregar histórico de notificações:', err);
  }
}

function saveNotificationsLogToDisk() {
  try {
    ensureStorageDir();
    const obj: Record<string, PublishNotificationRecord[]> = {};
    for (const [uid, list] of userNotificationsLog.entries()) {
      obj[uid] = list;
    }
    fs.writeFileSync(NOTIFICATIONS_LOG_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Push] Erro ao salvar histórico de notificações:', err);
  }
}

function loadScheduledJobsFromDisk() {
  try {
    if (fs.existsSync(SCHEDULED_JOBS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SCHEDULED_JOBS_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') {
        for (const [uid, jobs] of Object.entries(parsed)) {
          if (Array.isArray(jobs)) {
            userScheduledJobs.set(uid, jobs as ServerScheduledPublication[]);
          }
        }
      }
    }
  } catch (err) {
    console.warn('[Scheduler] Erro ao carregar agendamentos:', err);
  }
}

function saveScheduledJobsToDisk() {
  try {
    ensureStorageDir();
    const obj: Record<string, ServerScheduledPublication[]> = {};
    for (const [uid, jobs] of userScheduledJobs.entries()) {
      obj[uid] = jobs;
    }
    fs.writeFileSync(SCHEDULED_JOBS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[Scheduler] Erro ao salvar agendamentos:', err);
  }
}

loadPushSubscriptionsFromDisk();
loadNotificationsLogFromDisk();
loadScheduledJobsFromDisk();

function emitSseEvent(userId: string, eventName: string, data: any) {
  const clients = sseClientsByUser.get(userId);
  if (!clients || clients.size === 0) return;
  const serialized = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try {
      res.write(serialized);
    } catch {
      clients.delete(res);
    }
  }
}

async function sendPublishNotification(
  userId: string,
  payload: Omit<PublishNotificationRecord, 'id' | 'userId' | 'createdAt'>
): Promise<{ deliveredCount: number; event: PublishNotificationRecord }> {
  const eventRecord: PublishNotificationRecord = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    userId,
    createdAt: new Date().toISOString(),
    ...payload,
  };

  const existingLog = userNotificationsLog.get(userId) || [];
  userNotificationsLog.set(userId, [eventRecord, ...existingLog].slice(0, 50));
  saveNotificationsLogToDisk();

  // Real-time SSE notification to open browser tabs
  emitSseEvent(userId, 'publish_notification', eventRecord);

  // Web Push notifications via VAPID to registered Service Workers
  const subs = userPushSubscriptions.get(userId) || [];
  let deliveredCount = 0;
  const validSubs: StoredPushSubscription[] = [];

  for (const sub of subs) {
    const shouldSend =
      payload.type === 'push_test' ||
      (payload.type === 'publish_success' && sub.notifyOnSuccess !== false) ||
      (payload.type === 'publish_failure' && sub.notifyOnFailure !== false);

    if (!shouldSend) {
      validSubs.push(sub);
      continue;
    }

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime ?? null,
          keys: sub.keys,
        },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          publicationId: payload.publicationId,
          platforms: payload.platforms,
          url: payload.publicationId
            ? `/?tab=agendamentos&pub=${encodeURIComponent(payload.publicationId)}`
            : '/?tab=agendamentos',
          tag: `clipo-${payload.type}-${payload.publicationId || Date.now()}`,
        })
      );
      deliveredCount++;
      validSubs.push(sub);
    } catch (err: any) {
      const statusCode = err?.statusCode;
      if (statusCode === 404 || statusCode === 410) {
        console.log(`[Push] Removendo assinatura expirada (${statusCode}) para ${userId}`);
      } else {
        console.warn(`[Push] Falha ao entregar Web Push:`, err?.message || err);
        validSubs.push(sub);
      }
    }
  }

  if (validSubs.length !== subs.length) {
    userPushSubscriptions.set(userId, validSubs);
    savePushSubscriptionsToDisk();
  }

  return { deliveredCount, event: eventRecord };
}

function resolveLocalMediaFile(videoUrl?: string, storagePath?: string): {
  filePath: string;
  sizeBytes: number;
} | null {
  const candidates = [storagePath, videoUrl].filter(Boolean) as string[];
  for (const raw of candidates) {
    try {
      const mediaIdx = raw.indexOf('/media/');
      if (mediaIdx !== -1) {
        const sub = raw.substring(mediaIdx + 1); // "media/..."
        const resolved = path.resolve(__dirname, 'public', sub);
        if (resolved.startsWith(mediaDir) && fs.existsSync(resolved)) {
          const stat = fs.statSync(resolved);
          if (stat.isFile() && stat.size > 0) {
            return { filePath: resolved, sizeBytes: stat.size };
          }
        }
      }
    } catch {
      // ignore invalid path
    }
  }
  return null;
}

function formatPlatformDisplayName(platform: string): string {
  switch (platform) {
    case 'tiktok':
      return 'TikTok';
    case 'instagram':
      return 'Instagram';
    case 'youtube':
      return 'YouTube';
    case 'linkedin':
      return 'LinkedIn';
    default:
      return platform;
  }
}

async function ensureFreshTikTokToken(userId: string, conn: UserPlatformConnection): Promise<string> {
  const tokens = conn.tokens;
  if (!tokens?.accessToken) {
    throw new Error('Token de acesso TikTok ausente.');
  }
  if (tokens.expiresAt && Date.now() < tokens.expiresAt - 60_000) {
    return tokens.accessToken;
  }
  const clientKey = process.env.TIKTOK_CLIENT_KEY || process.env.VITE_TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET || process.env.VITE_TIKTOK_CLIENT_SECRET;
  if (tokens.refreshToken && clientKey && clientSecret) {
    try {
      const res = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: tokens.refreshToken,
        }),
      });
      const data = await res.json();
      if (data?.data?.access_token) {
        conn.tokens = {
          ...tokens,
          accessToken: data.data.access_token,
          refreshToken: data.data.refresh_token || tokens.refreshToken,
          expiresIn: data.data.expires_in,
          expiresAt: Date.now() + (data.data.expires_in || 3600) * 1000,
        };
        userSocialConnections.set(`${userId}:tiktok`, conn);
        saveSocialConnectionsToDisk();
        return conn.tokens.accessToken;
      }
    } catch (err) {
      console.warn('[TikTok] Falha ao renovar token:', err);
    }
  }
  return tokens.accessToken;
}

async function ensureFreshYouTubeToken(userId: string, conn: UserPlatformConnection): Promise<string> {
  const tokens = conn.tokens;
  if (!tokens?.accessToken) {
    throw new Error('Token de acesso YouTube ausente.');
  }
  if (tokens.expiresAt && Date.now() < tokens.expiresAt - 60_000) {
    return tokens.accessToken;
  }
  const clientId = process.env.YOUTUBE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  if (tokens.refreshToken && clientId && clientSecret) {
    try {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: tokens.refreshToken,
          grant_type: 'refresh_token',
        }),
      });
      const data = await res.json();
      if (data?.access_token) {
        conn.tokens = {
          ...tokens,
          accessToken: data.access_token,
          expiresIn: data.expires_in,
          expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        };
        userSocialConnections.set(`${userId}:youtube`, conn);
        saveSocialConnectionsToDisk();
        return conn.tokens.accessToken;
      }
    } catch (err) {
      console.warn('[YouTube] Falha ao renovar token:', err);
    }
  }
  return tokens.accessToken;
}

async function loadVideoBinary(videoUrl?: string, storagePath?: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const local = resolveLocalMediaFile(videoUrl, storagePath);
  if (local) {
    const ext = path.extname(local.filePath).toLowerCase();
    const mimeType = ext === '.mov' ? 'video/quicktime' : ext === '.webm' ? 'video/webm' : 'video/mp4';
    return { buffer: fs.readFileSync(local.filePath), mimeType };
  }
  if (videoUrl && (videoUrl.startsWith('http://') || videoUrl.startsWith('https://'))) {
    try {
      const resp = await fetch(videoUrl);
      if (resp.ok) {
        const arrBuf = await resp.arrayBuffer();
        const mimeType = resp.headers.get('content-type') || 'video/mp4';
        return { buffer: Buffer.from(arrBuf), mimeType };
      }
    } catch (err) {
      console.warn('[Media] Falha ao baixar vídeo remoto:', err);
    }
  }
  return null;
}

async function publishVideoToTikTok(
  userId: string,
  payload: { title: string; description: string; videoUrl?: string; storagePath?: string }
): Promise<{ platform: 'tiktok'; success: boolean; postId?: string; error?: string; publishedAt?: string }> {
  const conn = userSocialConnections.get(`${userId}:tiktok`);
  if (!conn || !conn.connected || !conn.tokens?.accessToken) {
    return {
      platform: 'tiktok',
      success: false,
      error: 'Conta TikTok não conectada via OAuth. Conecte em "Contas conectadas".',
    };
  }

  try {
    const accessToken = await ensureFreshTikTokToken(userId, conn);
    const localMedia = resolveLocalMediaFile(payload.videoUrl, payload.storagePath);
    const videoBytes = localMedia ? fs.readFileSync(localMedia.filePath) : null;
    const videoSize = videoBytes ? videoBytes.length : 1024 * 1024 * 15;

    const captionText = payload.description
      ? `${payload.title}\n\n${payload.description}`.slice(0, 2200)
      : payload.title.slice(0, 2200);

    const initResponse = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        post_info: {
          title: captionText,
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_duet: false,
          disable_stitch: false,
          disable_comment: false,
          video_cover_timestamp_ms: 1000,
        },
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    });

    const initData = await initResponse.json();
    if (initData.error && initData.error.code !== 'ok') {
      return {
        platform: 'tiktok',
        success: false,
        error: initData.error.message || 'Erro ao inicializar postagem na API Oficial do TikTok.',
      };
    }

    const publishId = initData.data?.publish_id;
    const uploadUrl = initData.data?.upload_url;

    if (uploadUrl && videoBytes) {
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
          'Content-Length': String(videoSize),
        },
        body: new Uint8Array(videoBytes),
      });

      if (!uploadRes.ok) {
        return {
          platform: 'tiktok',
          success: false,
          error: `Falha no envio do arquivo de vídeo para o TikTok (HTTP ${uploadRes.status}).`,
        };
      }
    }

    if (publishId) {
      await fetch('https://open.tiktokapis.com/v2/post/publish/status/fetch/', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({ publish_id: publishId }),
      }).catch(() => {});
    }

    return {
      platform: 'tiktok',
      success: true,
      postId: publishId,
      publishedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      platform: 'tiktok',
      success: false,
      error: err?.message || 'Erro de comunicação com a API Oficial do TikTok.',
    };
  }
}

async function publishVideoToYouTube(
  userId: string,
  payload: { title: string; description: string; videoUrl?: string; storagePath?: string; hashtags?: string[] }
): Promise<{ platform: 'youtube'; success: boolean; postId?: string; postUrl?: string; error?: string; publishedAt?: string }> {
  const conn = userSocialConnections.get(`${userId}:youtube`);
  if (!conn || !conn.connected || !conn.tokens?.accessToken) {
    return {
      platform: 'youtube',
      success: false,
      error: 'Canal YouTube não conectado via OAuth. Conecte em "Contas conectadas".',
    };
  }

  try {
    const accessToken = await ensureFreshYouTubeToken(userId, conn);
    const media = await loadVideoBinary(payload.videoUrl, payload.storagePath);
    if (!media) {
      return {
        platform: 'youtube',
        success: false,
        error: 'Arquivo de vídeo não localizado para envio à YouTube Data API v3.',
      };
    }

    const ytTitle = payload.title.includes('#Shorts')
      ? payload.title.slice(0, 100)
      : `${payload.title} #Shorts`.slice(0, 100);
    const tags = Array.isArray(payload.hashtags)
      ? payload.hashtags.map((h) => h.replace(/^#/, '')).slice(0, 15)
      : ['clipo', 'shorts'];

    const initRes = await fetch(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Length': String(media.buffer.length),
          'X-Upload-Content-Type': media.mimeType,
        },
        body: JSON.stringify({
          snippet: {
            title: ytTitle,
            description: payload.description || payload.title,
            tags,
            categoryId: '22',
          },
          status: {
            privacyStatus: 'public',
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const errJson = await initRes.json().catch(() => ({}));
      return {
        platform: 'youtube',
        success: false,
        error: errJson?.error?.message || `YouTube API retornou erro HTTP ${initRes.status}.`,
      };
    }

    const uploadLocation = initRes.headers.get('location');
    if (!uploadLocation) {
      return {
        platform: 'youtube',
        success: false,
        error: 'YouTube API não retornou URL de upload resumível.',
      };
    }

    const uploadRes = await fetch(uploadLocation, {
      method: 'PUT',
      headers: {
        'Content-Type': media.mimeType,
        'Content-Length': String(media.buffer.length),
      },
      body: new Uint8Array(media.buffer),
    });

    const uploadJson = await uploadRes.json().catch(() => ({}));
    if (!uploadRes.ok || !uploadJson.id) {
      return {
        platform: 'youtube',
        success: false,
        error: uploadJson?.error?.message || `Falha ao enviar vídeo ao YouTube (HTTP ${uploadRes.status}).`,
      };
    }

    return {
      platform: 'youtube',
      success: true,
      postId: uploadJson.id,
      postUrl: `https://youtube.com/shorts/${uploadJson.id}`,
      publishedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      platform: 'youtube',
      success: false,
      error: err?.message || 'Erro de comunicação com a API do YouTube.',
    };
  }
}

async function publishVideoToInstagram(
  userId: string,
  payload: { title: string; description: string; videoUrl?: string; storagePath?: string }
): Promise<{ platform: 'instagram'; success: boolean; postId?: string; error?: string; publishedAt?: string }> {
  const conn = userSocialConnections.get(`${userId}:instagram`);
  if (!conn || !conn.connected || !conn.tokens?.accessToken) {
    return {
      platform: 'instagram',
      success: false,
      error: 'Conta Instagram Business/Creator não conectada via OAuth.',
    };
  }

  try {
    const accessToken = conn.tokens.accessToken;
    const igUserId = conn.account?.id;
    if (!igUserId || igUserId === 'ig_account') {
      return {
        platform: 'instagram',
        success: false,
        error: 'ID da conta profissional do Instagram não encontrado. Reconecte sua conta.',
      };
    }

    let publicVideoUrl = payload.videoUrl || '';
    if (publicVideoUrl.startsWith('/')) {
      publicVideoUrl = `${getBaseAppUrl()}${publicVideoUrl}`;
    } else if (!publicVideoUrl && payload.storagePath && payload.storagePath.startsWith('/media/')) {
      publicVideoUrl = `${getBaseAppUrl()}${payload.storagePath}`;
    }

    if (!publicVideoUrl) {
      return {
        platform: 'instagram',
        success: false,
        error: 'URL pública do vídeo é necessária para publicação de Reels via Meta Graph API.',
      };
    }

    const caption = payload.description
      ? `${payload.title}\n\n${payload.description}`.slice(0, 2200)
      : payload.title.slice(0, 2200);

    // Step 1: Create Reels media container
    const containerRes = await fetch(`https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        media_type: 'REELS',
        video_url: publicVideoUrl,
        caption,
        access_token: accessToken,
      }),
    });
    const containerData = await containerRes.json();
    if (!containerRes.ok || !containerData.id) {
      return {
        platform: 'instagram',
        success: false,
        error: containerData?.error?.message || 'Erro ao criar container de Reels no Instagram Graph API.',
      };
    }

    const creationId = containerData.id;

    // Step 2: Poll container status briefly before publishing
    for (let attempt = 0; attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 1500));
      const statusRes = await fetch(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(creationId)}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`
      );
      const statusData = await statusRes.json().catch(() => ({}));
      if (statusData.status_code === 'FINISHED') break;
      if (statusData.status_code === 'ERROR') {
        return {
          platform: 'instagram',
          success: false,
          error: 'Instagram Graph API reportou erro ao processar o arquivo de vídeo.',
        };
      }
    }

    // Step 3: Publish container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(igUserId)}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          creation_id: creationId,
          access_token: accessToken,
        }),
      }
    );
    const publishData = await publishRes.json();
    if (!publishRes.ok || !publishData.id) {
      return {
        platform: 'instagram',
        success: false,
        error: publishData?.error?.message || 'Erro ao finalizar publicação no Instagram.',
      };
    }

    return {
      platform: 'instagram',
      success: true,
      postId: publishData.id,
      publishedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      platform: 'instagram',
      success: false,
      error: err?.message || 'Erro de comunicação com a Instagram Graph API.',
    };
  }
}

async function publishVideoToLinkedIn(
  userId: string,
  payload: { title: string; description: string; videoUrl?: string; storagePath?: string }
): Promise<{ platform: 'linkedin'; success: boolean; postId?: string; error?: string; publishedAt?: string }> {
  const conn = userSocialConnections.get(`${userId}:linkedin`);
  if (!conn || !conn.connected || !conn.tokens?.accessToken) {
    return {
      platform: 'linkedin',
      success: false,
      error: 'Conta LinkedIn não conectada via OAuth. Conecte em "Contas conectadas".',
    };
  }

  try {
    const accessToken = conn.tokens.accessToken;
    const memberId = conn.account?.id;
    if (!memberId || memberId === 'li_member') {
      return {
        platform: 'linkedin',
        success: false,
        error: 'ID de membro LinkedIn ausente. Reconecte sua conta LinkedIn.',
      };
    }

    const authorUrn = `urn:li:person:${memberId}`;
    const media = await loadVideoBinary(payload.videoUrl, payload.storagePath);
    if (!media) {
      return {
        platform: 'linkedin',
        success: false,
        error: 'Arquivo de vídeo não localizado para envio à API do LinkedIn.',
      };
    }

    // Step 1: Initialize video upload on LinkedIn REST API
    const initRes = await fetch('https://api.linkedin.com/rest/videos?action=initializeUpload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: authorUrn,
          fileSizeBytes: media.buffer.length,
          uploadCaptions: false,
          uploadThumbnail: false,
        },
      }),
    });

    const initData = await initRes.json().catch(() => ({}));
    const uploadUrl = initData?.value?.uploadInstructions?.[0]?.uploadUrl;
    const videoUrn = initData?.value?.video;

    if (!initRes.ok || !uploadUrl || !videoUrn) {
      return {
        platform: 'linkedin',
        success: false,
        error: initData?.message || 'Erro ao inicializar upload de vídeo na API do LinkedIn.',
      };
    }

    // Step 2: Upload binary chunk
    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: new Uint8Array(media.buffer),
    });
    const etag = putRes.headers.get('etag');
    if (!putRes.ok) {
      return {
        platform: 'linkedin',
        success: false,
        error: `Falha ao enviar vídeo ao LinkedIn (HTTP ${putRes.status}).`,
      };
    }

    // Step 3: Finalize upload
    await fetch('https://api.linkedin.com/rest/videos?action=finalizeUpload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        finalizeUploadRequest: {
          video: videoUrn,
          uploadToken: '',
          uploadedPartIds: etag ? [etag.replace(/"/g, '')] : [],
        },
      }),
    });

    // Step 4: Create LinkedIn Post referencing video URN
    const postRes = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202401',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: authorUrn,
        commentary: payload.description ? `${payload.title}\n\n${payload.description}` : payload.title,
        visibility: 'PUBLIC',
        distribution: {
          feedDistribution: 'MAIN_FEED',
          targetEntities: [],
          thirdPartyDistributionChannels: [],
        },
        content: {
          media: {
            title: payload.title,
            id: videoUrn,
          },
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
      }),
    });

    if (!postRes.ok) {
      const postErr = await postRes.json().catch(() => ({}));
      return {
        platform: 'linkedin',
        success: false,
        error: postErr?.message || `Erro ao publicar post no LinkedIn (HTTP ${postRes.status}).`,
      };
    }

    return {
      platform: 'linkedin',
      success: true,
      postId: postRes.headers.get('x-restli-id') || videoUrn,
      publishedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    return {
      platform: 'linkedin',
      success: false,
      error: err?.message || 'Erro de comunicação com a API do LinkedIn.',
    };
  }
}

async function executeMultiPlatformPublish(params: {
  publicationId?: string;
  userId: string;
  title: string;
  description: string;
  videoUrl?: string;
  storagePath?: string;
  platforms: Array<'tiktok' | 'instagram' | 'youtube' | 'linkedin'>;
  hashtags?: string[];
  notifyOnSuccess?: boolean;
  notifyOnFailure?: boolean;
}): Promise<{
  success: boolean;
  status: 'publicado' | 'falhou';
  platformResults: NonNullable<PublishNotificationRecord['platformResults']>;
  error?: string;
  pushSent: boolean;
  publishedAt?: string;
}> {
  const targetPlatforms = Array.isArray(params.platforms) && params.platforms.length > 0
    ? params.platforms
    : (['tiktok'] as Array<'tiktok' | 'instagram' | 'youtube' | 'linkedin'>);

  const platformResults = await Promise.all(
    targetPlatforms.map(async (platform) => {
      if (platform === 'tiktok') {
        return publishVideoToTikTok(params.userId, params);
      }
      if (platform === 'youtube') {
        return publishVideoToYouTube(params.userId, params);
      }
      if (platform === 'instagram') {
        return publishVideoToInstagram(params.userId, params);
      }
      return publishVideoToLinkedIn(params.userId, params);
    })
  );

  const succeeded = platformResults.filter((r) => r.success);
  const failed = platformResults.filter((r) => !r.success);
  const allSucceeded = succeeded.length > 0;
  const publishedAt = allSucceeded ? new Date().toISOString() : undefined;

  let pushSent = false;

  if (allSucceeded && params.notifyOnSuccess !== false) {
    const names = succeeded.map((r) => formatPlatformDisplayName(r.platform)).join(', ');
    const notifResult = await sendPublishNotification(params.userId, {
      type: 'publish_success',
      title: `Publicado com sucesso em ${names}`,
      body: `"${params.title}" foi publicado no seu canal (${names}).`,
      publicationId: params.publicationId,
      platforms: succeeded.map((r) => r.platform),
      platformResults,
    });
    pushSent = notifResult.deliveredCount > 0;
  } else if (!allSucceeded && params.notifyOnFailure !== false) {
    const names = failed.map((r) => formatPlatformDisplayName(r.platform)).join(', ');
    const firstErr = failed[0]?.error || 'Erro ao publicar nas redes selecionadas.';
    await sendPublishNotification(params.userId, {
      type: 'publish_failure',
      title: `Falha ao publicar em ${names}`,
      body: `"${params.title}": ${firstErr}`,
      publicationId: params.publicationId,
      platforms: failed.map((r) => r.platform),
      platformResults,
    });
  }

  return {
    success: allSucceeded,
    status: allSucceeded ? 'publicado' : 'falhou',
    platformResults,
    error: failed.length > 0 ? failed.map((f) => `${formatPlatformDisplayName(f.platform)}: ${f.error}`).join(' | ') : undefined,
    pushSent,
    publishedAt,
  };
}

// Legacy single-platform TikTok publish endpoint (updated to use real upload helper)
app.post('/api/tiktok/publish', async (req: Request, res: Response) => {
  const { title, description, videoUrl, storagePath, userId = 'default_user', publicationId } = req.body;
  const result = await publishVideoToTikTok(String(userId), {
    title: String(title || 'Vídeo Clipo'),
    description: String(description || ''),
    videoUrl,
    storagePath,
  });

  if (!result.success) {
    const isAuthErr = result.error?.includes('OAuth');
    return res.status(isAuthErr ? 401 : 400).json({
      success: false,
      error: result.error,
      requiresAuth: isAuthErr,
    });
  }

  await sendPublishNotification(String(userId), {
    type: 'publish_success',
    title: 'Publicado com sucesso no TikTok',
    body: `"${title || 'Seu vídeo'}" foi enviado via API Oficial do TikTok.`,
    publicationId,
    platforms: ['tiktok'],
    platformResults: [result],
  });

  return res.json({
    success: true,
    publishId: result.postId,
    message: 'Publicação concluída com sucesso na API Oficial do TikTok.',
  });
});

// Unified Multi-Platform Publish Endpoint (TikTok, YouTube, Instagram, LinkedIn)
app.post('/api/publish', async (req: Request, res: Response) => {
  const {
    publicationId,
    userId = 'default_user',
    title = 'Publicação Clipo',
    description = '',
    videoUrl,
    storagePath,
    platforms = ['tiktok'],
    hashtags,
    notifyOnSuccess = true,
    notifyOnFailure = true,
  } = req.body || {};

  const outcome = await executeMultiPlatformPublish({
    publicationId,
    userId: String(userId),
    title: String(title),
    description: String(description),
    videoUrl,
    storagePath,
    platforms,
    hashtags,
    notifyOnSuccess,
    notifyOnFailure,
  });

  return res.status(outcome.success ? 200 : 400).json(outcome);
});

// Push Notifications Endpoints
app.get('/api/push/vapid-public-key', (_req: Request, res: Response) => {
  return res.json({ publicKey: vapidConfig.publicKey });
});

app.get('/api/push/status', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  const subs = userPushSubscriptions.get(userId) || [];
  return res.json({
    subscribed: subs.length > 0,
    subscriptionCount: subs.length,
    notifyOnSuccess: subs[0]?.notifyOnSuccess ?? true,
    notifyOnFailure: subs[0]?.notifyOnFailure ?? true,
  });
});

app.post('/api/push/subscribe', (req: Request, res: Response) => {
  const {
    userId = 'default_user',
    subscription,
    notifyOnSuccess = true,
    notifyOnFailure = true,
  } = req.body || {};

  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ success: false, error: 'Assinatura Push inválida.' });
  }

  const uid = String(userId);
  const existing = userPushSubscriptions.get(uid) || [];
  const now = new Date().toISOString();
  const nextSub: StoredPushSubscription = {
    endpoint: subscription.endpoint,
    expirationTime: subscription.expirationTime ?? null,
    keys: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    userId: uid,
    notifyOnSuccess: Boolean(notifyOnSuccess),
    notifyOnFailure: Boolean(notifyOnFailure),
    createdAt: now,
    updatedAt: now,
  };

  const filtered = existing.filter((s) => s.endpoint !== subscription.endpoint);
  userPushSubscriptions.set(uid, [nextSub, ...filtered]);
  savePushSubscriptionsToDisk();

  return res.json({ success: true, subscriptionCount: filtered.length + 1 });
});

app.post('/api/push/unsubscribe', (req: Request, res: Response) => {
  const { userId = 'default_user', endpoint } = req.body || {};
  const uid = String(userId);
  const existing = userPushSubscriptions.get(uid) || [];
  const next = endpoint ? existing.filter((s) => s.endpoint !== endpoint) : [];
  userPushSubscriptions.set(uid, next);
  savePushSubscriptionsToDisk();
  return res.json({ success: true, subscriptionCount: next.length });
});

app.post('/api/push/preferences', (req: Request, res: Response) => {
  const { userId = 'default_user', notifyOnSuccess = true, notifyOnFailure = true } = req.body || {};
  const uid = String(userId);
  const existing = userPushSubscriptions.get(uid) || [];
  const updated = existing.map((s) => ({
    ...s,
    notifyOnSuccess: Boolean(notifyOnSuccess),
    notifyOnFailure: Boolean(notifyOnFailure),
    updatedAt: new Date().toISOString(),
  }));
  userPushSubscriptions.set(uid, updated);
  savePushSubscriptionsToDisk();
  return res.json({ success: true });
});

app.post('/api/push/test', async (req: Request, res: Response) => {
  const { userId = 'default_user' } = req.body || {};
  const uid = String(userId);
  const result = await sendPublishNotification(uid, {
    type: 'push_test',
    title: 'Clipo — Notificação Push Ativa',
    body: 'Você receberá alertas automáticos assim que um agendamento for publicado nas redes conectadas.',
    platforms: ['tiktok', 'instagram', 'youtube'],
  });

  return res.json({
    success: true,
    deliveredCount: result.deliveredCount,
    message:
      result.deliveredCount > 0
        ? 'Notificação Push enviada ao navegador com sucesso!'
        : 'Evento enviado em tempo real para a sessão ativa (ative a permissão do navegador para Push em segundo plano).',
  });
});

app.get('/api/notifications/history', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  return res.json({
    notifications: userNotificationsLog.get(userId) || [],
  });
});

app.get('/api/notifications/stream', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let set = sseClientsByUser.get(userId);
  if (!set) {
    set = new Set<Response>();
    sseClientsByUser.set(userId, set);
  }
  set.add(res);

  res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, userId })}\n\n`);

  const keepAlive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      clearInterval(keepAlive);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    set?.delete(res);
  });
});

// Scheduled Jobs Sync & Background Automated Dispatcher
app.get('/api/schedules', (req: Request, res: Response) => {
  const userId = String(req.query.userId || 'default_user');
  return res.json({
    publications: userScheduledJobs.get(userId) || [],
  });
});

app.post('/api/schedules/sync', (req: Request, res: Response) => {
  const { userId = 'default_user', publications = [] } = req.body || {};
  const uid = String(userId);
  const existing = userScheduledJobs.get(uid) || [];
  const existingById = new Map(existing.map((j) => [j.id, j]));

  const incoming: ServerScheduledPublication[] = Array.isArray(publications)
    ? publications.map((pub: any) => {
        const prev = existingById.get(pub.id);
        // Keep backend-finished states if server already published it
        if (prev && (prev.status === 'publicado' || prev.status === 'processando') && pub.status === 'agendado') {
          return prev;
        }
        return {
          ...pub,
          userId: uid,
          updatedAt: new Date().toISOString(),
        };
      })
    : [];

  userScheduledJobs.set(uid, incoming);
  saveScheduledJobsToDisk();
  return res.json({ success: true, publications: incoming });
});

function parseScheduledDateTime(job: ServerScheduledPublication): number | null {
  if (!job.dateISO || !job.scheduledTime) return null;
  const isoCandidate = `${job.dateISO}T${job.scheduledTime}:00`;
  const ts = Date.parse(isoCandidate);
  return isNaN(ts) ? null : ts;
}

let isSchedulerRunning = false;
setInterval(async () => {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;
  try {
    const now = Date.now();
    for (const [uid, jobs] of userScheduledJobs.entries()) {
      let modified = false;
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        if (job.status !== 'agendado') continue;
        const dueAt = parseScheduledDateTime(job);
        if (dueAt !== null && dueAt <= now) {
          job.status = 'processando';
          job.updatedAt = new Date().toISOString();
          modified = true;
          saveScheduledJobsToDisk();
          emitSseEvent(uid, 'schedule_updated', job);

          const subs = userPushSubscriptions.get(uid) || [];
          const notifyOnSuccess = subs[0]?.notifyOnSuccess ?? true;
          const notifyOnFailure = subs[0]?.notifyOnFailure ?? true;

          const result = await executeMultiPlatformPublish({
            publicationId: job.id,
            userId: uid,
            title: job.title,
            description: job.description,
            videoUrl: job.videoUrl,
            storagePath: job.storagePath,
            platforms: job.platforms,
            hashtags: job.hashtags,
            notifyOnSuccess,
            notifyOnFailure,
          });

          job.status = result.status;
          job.platformResults = result.platformResults;
          job.publishedAt = result.publishedAt;
          job.errorMessage = result.error;
          job.pushNotified = result.pushSent;
          job.updatedAt = new Date().toISOString();
          modified = true;
          emitSseEvent(uid, 'schedule_updated', job);
        }
      }
      if (modified) {
        userScheduledJobs.set(uid, jobs);
        saveScheduledJobsToDisk();
      }
    }
  } catch (err) {
    console.warn('[Scheduler] Erro no ciclo automático:', err);
  } finally {
    isSchedulerRunning = false;
  }
}, 20000);

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

// Runtime configuration endpoint for Supabase public client parameters
app.get('/api/config', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  const clean = (val?: string) => (val ? val.replace(/^["']+|["']+$/g, '').trim() : '');

  const url = clean(
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  );

  const anonKey = clean(
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    ''
  );

  return res.json({
    configured: Boolean(url && anonKey),
    url,
    anonKey,
  });
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
// 4. VITE MIDDLEWARE SETUP & SERVER STARTUP
// ==========================================
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
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

// In local environment or traditional Node hosting, start the HTTP server
// In Vercel serverless environment, Vercel imports and handles requests directly
if (!process.env.VERCEL) {
  startServer();
}

export default app;
export { app };
