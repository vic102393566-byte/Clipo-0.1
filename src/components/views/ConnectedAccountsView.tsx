import React, { useState, useEffect } from 'react';
import {
  Share2,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Key,
  ShieldCheck,
  Loader2,
  Lock,
  Copy,
  Check,
  X,
  Info,
  Youtube,
  Instagram
} from 'lucide-react';
import { SocialAccount, SocialPlatform } from '../../types';
import { socialAccountsService, AuthUrlResponse, AllConnectionsStatusResponse } from '../../services/socialAccountsService';

interface ConnectedAccountsViewProps {
  accounts: SocialAccount[];
  userId?: string;
  onToggleConnect?: (id: string) => void;
  onUpdateAccount?: (platform: SocialPlatform, account: Partial<SocialAccount> & { connected: boolean }) => void;
  onUpdateTikTokAccount?: (account: Partial<SocialAccount> & { connected: boolean }) => void;
  maxSocialAccounts?: number;
  planName?: string;
  onUpgradeClick?: () => void;
  onBack?: () => void;
}

interface PlatformConfigGuide {
  id: SocialPlatform;
  name: string;
  portalName: string;
  portalUrl: string;
  callbackPath: string;
  envKeys: string[];
  scopes: string[];
  description: string;
}

const PLATFORMS_CONFIG_GUIDE: Record<'youtube' | 'instagram' | 'tiktok', PlatformConfigGuide> = {
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    portalName: 'Google Cloud Console (Credentials)',
    portalUrl: 'https://console.cloud.google.com/apis/credentials',
    callbackPath: '/api/auth/youtube/callback',
    envKeys: ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET'],
    scopes: [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    description: 'Permite conectar canais do YouTube para leitura de inscritos e upload oficial de Shorts e vídeos longos.',
  },
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    portalName: 'Meta for Developers (Instagram Graph API)',
    portalUrl: 'https://developers.facebook.com',
    callbackPath: '/api/auth/instagram/callback',
    envKeys: ['INSTAGRAM_CLIENT_ID', 'INSTAGRAM_CLIENT_SECRET'],
    scopes: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
    ],
    description: 'Permite autenticar contas profissionais/creator do Instagram para publicação de Reels e visualização de seguidores.',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    portalName: 'TikTok for Developers',
    portalUrl: 'https://developers.tiktok.com',
    callbackPath: '/api/auth/tiktok/callback',
    envKeys: ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET'],
    scopes: [
      'user.info.basic',
      'user.info.profile',
      'video.upload',
      'video.publish',
    ],
    description: 'Permite conectar contas do TikTok via Direct Post API v2 oficial para envio programado de vídeos curtos.',
  },
};

export const ConnectedAccountsView: React.FC<ConnectedAccountsViewProps> = ({
  accounts,
  userId = 'default_user',
  onToggleConnect,
  onUpdateAccount,
  onUpdateTikTokAccount,
  maxSocialAccounts = 3,
  planName = 'Pro',
  onUpgradeClick,
  onBack,
}) => {
  const [activePlatformAuthenticating, setActivePlatformAuthenticating] = useState<SocialPlatform | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccessMsg, setAuthSuccessMsg] = useState<string | null>(null);

  // Configuration Guide Modal State
  const [selectedGuidePlatform, setSelectedGuidePlatform] = useState<'youtube' | 'instagram' | 'tiktok' | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Connected accounts count
  const connectedCount = accounts.filter((a) => a.connected).length;
  const isAccountLimitReached = connectedCount >= maxSocialAccounts;

  const getBaseAppUrl = () => {
    return 'https://ais-dev-lfcxezhilf74k3anceyuue-460308902554.us-east1.run.app';
  };

  const getSharedAppUrl = () => {
    return 'https://ais-pre-lfcxezhilf74k3anceyuue-460308902554.us-east1.run.app';
  };

  // Cross-origin message listener for OAuth Popup flows (YouTube, Instagram, TikTok)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const platform = event.data.platform as SocialPlatform;
        const accountData = event.data.account;

        setActivePlatformAuthenticating(null);
        setAuthError(null);
        setAuthSuccessMsg(`Conta do ${platform.toUpperCase()} conectada com sucesso via OAuth oficial!`);

        const updatedPayload: Partial<SocialAccount> & { connected: boolean } = {
          connected: true,
          handle: accountData?.handle || `@${platform}_user`,
          name: accountData?.name || `Criador ${platform}`,
          avatar: accountData?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
          followers: accountData?.followers || '0',
          connectedAt: new Date().toISOString(),
        };

        if (onUpdateAccount) {
          onUpdateAccount(platform, updatedPayload);
        } else if (platform === 'tiktok' && onUpdateTikTokAccount) {
          onUpdateTikTokAccount(updatedPayload);
        }
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR') {
        const platform = event.data.platform || 'rede social';
        setActivePlatformAuthenticating(null);
        setAuthError(`Erro na autorização do ${platform}: ${event.data.error || 'Acesso negado pelo usuário ou provedor.'}`);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onUpdateAccount, onUpdateTikTokAccount]);

  // Sync real connection status from backend on mount or when userId changes
  useEffect(() => {
    let isCancelled = false;

    async function loadBackendStatus() {
      try {
        const res = await socialAccountsService.getStatus(userId);
        if (isCancelled || !res) return;

        (['youtube', 'instagram', 'tiktok'] as SocialPlatform[]).forEach((plat) => {
          const status = res[plat as keyof AllConnectionsStatusResponse];
          if (status) {
            const currentAcc = accounts.find((a) => a.platform === plat);
            if (status.connected && status.account && !currentAcc?.connected) {
              const updatedPayload = {
                connected: true,
                handle: status.account.handle,
                name: status.account.name,
                avatar: status.account.avatarUrl || currentAcc?.avatar || '',
                followers: status.account.followersFormatted || String(status.account.followerCount || 0),
                connectedAt: status.connectedAt || new Date().toISOString(),
              };
              if (onUpdateAccount) {
                onUpdateAccount(plat, updatedPayload);
              }
            } else if (!status.connected && currentAcc?.connected) {
              // Ensure no fake connected state
              if (onUpdateAccount) {
                onUpdateAccount(plat, { connected: false });
              }
            }
          }
        });
      } catch (err) {
        console.warn('Status das contas sociais no backend indisponível:', err);
      }
    }

    loadBackendStatus();
    return () => {
      isCancelled = true;
    };
  }, [userId]);

  // Initiate OAuth Flow with Popup
  const handleConnectPlatform = async (platform: 'youtube' | 'instagram' | 'tiktok') => {
    setAuthError(null);
    setAuthSuccessMsg(null);
    setActivePlatformAuthenticating(platform);

    try {
      // 1. Fetch OAuth URL from backend (tokens and secrets remain on backend only)
      const authData: AuthUrlResponse = await socialAccountsService.getAuthUrl(platform, userId);

      // If missing client keys, show config guide
      if (!authData.configured || !authData.url) {
        setActivePlatformAuthenticating(null);
        setSelectedGuidePlatform(platform);
        setAuthError(
          `Para conectar ao ${PLATFORMS_CONFIG_GUIDE[platform].name}, configure as variáveis de ambiente necessárias (${PLATFORMS_CONFIG_GUIDE[platform].envKeys.join(', ')}) no Secrets ou no arquivo .env.`
        );
        return;
      }

      // 2. Open provider OAuth URL in popup (AI Studio OAuth guidelines: never container URL)
      const width = 600;
      const height = 720;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authData.url,
        `${platform}_oauth_popup`,
        `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes,scrollbars=yes`
      );

      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        setActivePlatformAuthenticating(null);
        setAuthError('O pop-up de autorização foi bloqueado pelo navegador. Por favor, habilite pop-ups para este site.');
        return;
      }

      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          setActivePlatformAuthenticating(null);
        }
      }, 1000);
    } catch (err: any) {
      setActivePlatformAuthenticating(null);
      setAuthError(err.message || `Falha ao iniciar o fluxo OAuth com o ${platform}.`);
    }
  };

  // Disconnect social account securely on backend and local state
  const handleDisconnectPlatform = async (platform: 'youtube' | 'instagram' | 'tiktok') => {
    const platformLabel = PLATFORMS_CONFIG_GUIDE[platform].name;
    if (!confirm(`Deseja desconectar sua conta do ${platformLabel}? O Clipo não terá mais acesso para agendamentos neste canal.`)) {
      return;
    }

    try {
      await socialAccountsService.disconnect(platform, userId);

      if (onUpdateAccount) {
        onUpdateAccount(platform, {
          connected: false,
          connectedAt: undefined,
        });
      } else if (platform === 'tiktok' && onUpdateTikTokAccount) {
        onUpdateTikTokAccount({
          connected: false,
          connectedAt: undefined,
        });
      }

      setAuthSuccessMsg(`Conta do ${platformLabel} desconectada com sucesso.`);
    } catch (err: any) {
      console.error(`Erro ao desconectar ${platform}:`, err);
      setAuthError(err.message || `Erro ao desconectar conta do ${platformLabel}.`);
    }
  };

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const corePlatforms: {
    id: 'youtube' | 'instagram' | 'tiktok';
    name: string;
    subname: string;
    desc: string;
    icon: React.ReactNode;
    colorClasses: string;
  }[] = [
    {
      id: 'youtube',
      name: 'YouTube',
      subname: 'Shorts & Vídeos',
      desc: 'API Google OAuth 2.0: envio oficial de Shorts e vídeos longos com metadados completos.',
      icon: <Youtube className="h-5 w-5 text-red-500" />,
      colorClasses: 'hover:border-red-500/40',
    },
    {
      id: 'instagram',
      name: 'Instagram',
      subname: 'Reels & Feed',
      desc: 'API Meta Graph: publicação direta de Reels, carrosséis de cortes e contagem de seguidores.',
      icon: <Instagram className="h-5 w-5 text-pink-500" />,
      colorClasses: 'hover:border-pink-500/40',
    },
    {
      id: 'tiktok',
      name: 'TikTok',
      subname: 'Direct Post v2',
      desc: 'API Oficial TikTok v2: publicação com privacidade configurável, áudios e hashtags virais.',
      icon: <Share2 className="h-5 w-5 text-cyan-400" />,
      colorClasses: 'hover:border-cyan-500/40',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Back Navigation Button */}
      {onBack && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#FDBA74] hover:text-white transition py-1.5 px-3 -ml-1 rounded-xl hover:bg-[#151515] border border-transparent hover:border-[#27272A] cursor-pointer group"
            title="Voltar para a tela anterior"
          >
            <span className="text-base font-bold leading-none transition-transform group-hover:-translate-x-0.5">←</span>
            <span>Voltar</span>
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
              Canais Oficiais OAuth
            </span>
          </div>
          <h2 className="mt-1 text-lg font-bold text-white">Contas de redes sociais</h2>
          <p className="text-xs text-slate-400">
            Conecte e gerencie suas contas no YouTube, Instagram e TikTok com autenticação OAuth segura
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="rounded-xl border border-[#27272A] bg-[#151515] px-3.5 py-2 font-mono text-xs text-[#FDBA74]">
            Canais ativos: <strong className="text-white">{connectedCount}</strong> / {maxSocialAccounts} (Plano {planName})
          </div>
          <button
            onClick={() => setSelectedGuidePlatform('youtube')}
            className="flex items-center gap-1.5 rounded-xl border border-[#27272A] bg-[#151515] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#1E1E1E] transition cursor-pointer"
          >
            <Key className="h-3.5 w-3.5 text-[#F97316]" />
            <span>Guia de credenciais OAuth</span>
          </button>
        </div>
      </div>

      {/* Account Limit Reached Banner */}
      {isAccountLimitReached && (
        <div className="flex items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div>
            <span className="font-semibold text-amber-100">Limite de contas atingido:</span>
            <p className="mt-0.5 text-amber-300/90">
              O plano {planName} permite conectar até {maxSocialAccounts} canais. Para conectar mais contas simultaneamente, faça upgrade na aba "Meu plano".
            </p>
          </div>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="rounded-xl bg-[#F97316] px-3 py-1.5 font-semibold text-white hover:bg-[#EA580C] shrink-0 text-xs transition cursor-pointer"
            >
              Fazer upgrade
            </button>
          )}
        </div>
      )}

      {/* Success Notification */}
      {authSuccessMsg && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-300 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{authSuccessMsg}</span>
          </div>
          <button
            onClick={() => setAuthSuccessMsg(null)}
            className="text-emerald-400 hover:text-emerald-200 text-xs font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Notification */}
      {authError && (
        <div className="flex items-start justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 animate-in fade-in">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span className="leading-relaxed">{authError}</span>
          </div>
          <button
            onClick={() => setAuthError(null)}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold ml-2 shrink-0 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Security & Token Guarantee Notice */}
      <div className="flex items-center gap-2.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 text-xs text-[#FDBA74]">
        <ShieldCheck className="h-4 w-4 text-[#F97316] shrink-0" />
        <span>
          <strong>Segurança OAuth de ponta a ponta:</strong> Tokens de acesso e segredos de clientes são criptografados e armazenados exclusivamente no backend por usuário. O frontend nunca tem acesso a credenciais sensíveis.
        </span>
      </div>

      {/* Main Grid: 1. YouTube, 2. Instagram, 3. TikTok */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {corePlatforms.map((p) => {
          const acc = accounts.find((a) => a.platform === p.id);
          const isConnected = acc?.connected ?? false;
          const isAuthenticating = activePlatformAuthenticating === p.id;

          return (
            <div
              key={p.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition bg-[#151515] ${
                isConnected
                  ? 'border-emerald-500/40 shadow-lg shadow-emerald-950/10'
                  : `border-[#27272A] ${p.colorClasses}`
              }`}
            >
              <div>
                {/* Header of Card */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#27272A] bg-[#0A0A0A]">
                      {p.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-sm font-bold text-white">{p.name}</h3>
                        <span className="text-[10px] font-medium text-[#FDBA74]">
                          {p.subname}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#A1A1AA] mt-0.5 line-clamp-2">
                        {p.desc}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-[#FDBA74] font-medium">Status da conexão:</span>
                  {isConnected ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Conectado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-800/60 border border-zinc-700/60 px-2.5 py-0.5 text-xs font-medium text-zinc-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                      Não conectado
                    </span>
                  )}
                </div>

                {/* Account Details Box (Shown when connected) */}
                {isConnected && acc && (
                  <div className="mt-3.5 rounded-xl bg-[#0A0A0A] border border-[#27272A] p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={acc.avatar}
                          alt={acc.name}
                          referrerPolicy="no-referrer"
                          className="h-9 w-9 rounded-full object-cover border border-[#27272A] bg-zinc-900"
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate" title={acc.name}>
                            {acc.name}
                          </p>
                          <p className="font-mono text-[11px] text-[#F97316] truncate">
                            {acc.handle}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="font-mono text-xs tabular-nums text-white font-semibold">
                          {acc.followers || '0'}
                        </span>
                        <p className="text-[10px] text-[#FDBA74]">
                          {p.id === 'youtube' ? 'inscritos' : 'seguidores'}
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[#27272A] pt-1.5 flex items-center justify-between text-[10px] text-[#A1A1AA] font-mono">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <Lock className="h-3 w-3" />
                        <span>Token seguro no backend</span>
                      </span>
                      <span>{acc.connectedAt ? 'Ativo' : 'OAuth v2'}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons: Conectar / Desconectar */}
              <div className="mt-5 border-t border-[#27272A] pt-3">
                {isConnected ? (
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleDisconnectPlatform(p.id)}
                      className="text-xs font-medium text-rose-400 hover:text-rose-300 transition cursor-pointer py-1.5"
                    >
                      Desconectar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConnectPlatform(p.id)}
                      disabled={isAuthenticating}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#0A0A0A] px-3 py-1.5 text-xs font-medium text-[#FDBA74] hover:text-white transition cursor-pointer disabled:opacity-50"
                      title="Reautenticar ou atualizar permissões"
                    >
                      <RefreshCw className={`h-3 w-3 ${isAuthenticating ? 'animate-spin' : ''}`} />
                      <span>Reconectar</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (isAccountLimitReached) {
                        setAuthError(
                          `Limite de ${maxSocialAccounts} conta(s) do plano ${planName} atingido. Faça upgrade na aba "Meu plano" para conectar mais canais.`
                        );
                        return;
                      }
                      handleConnectPlatform(p.id);
                    }}
                    disabled={isAuthenticating}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F97316] py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/20 hover:bg-[#EA580C] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                  >
                    {isAuthenticating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Aguardando autorização...</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="h-4 w-4" />
                        <span>Conectar {p.name}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* OAuth Setup & Credentials Guide Modal */}
      {selectedGuidePlatform && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedGuidePlatform(null)}
          />

          <div className="relative w-full max-w-xl rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#27272A] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/20 text-[#F97316]">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Guia de Configuração: {PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].name}
                  </h3>
                  <p className="text-xs text-[#FDBA74]">
                    Instruções para registrar o App e cadastrar as credenciais OAuth
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedGuidePlatform(null)}
                className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Platform Selector Tabs */}
            <div className="flex rounded-xl bg-[#0A0A0A] p-1 border border-[#27272A]">
              {(['youtube', 'instagram', 'tiktok'] as const).map((platId) => (
                <button
                  key={platId}
                  onClick={() => setSelectedGuidePlatform(platId)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer ${
                    selectedGuidePlatform === platId
                      ? 'bg-[#F97316] text-white shadow'
                      : 'text-[#FDBA74] hover:text-white'
                  }`}
                >
                  {PLATFORMS_CONFIG_GUIDE[platId].name}
                </button>
              ))}
            </div>

            <div className="space-y-4 text-xs text-white">
              {/* Step 1: Developer Console */}
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5 space-y-2">
                <span className="text-xs font-bold text-[#F97316] block">
                  1. Acessar o Portal de Desenvolvedores
                </span>
                <p className="text-slate-300">
                  Cadastre ou abra seu aplicativo oficial em:
                </p>
                <a
                  href={PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].portalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#F97316] underline hover:text-[#EA580C]"
                >
                  <span>{PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].portalName}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>

              {/* Step 2: Redirect URI */}
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5 space-y-2">
                <span className="text-xs font-bold text-[#F97316] block">
                  2. Cadastrar as URIs de Redirecionamento (Redirect URIs)
                </span>
                <p className="text-slate-300">
                  No painel de configurações OAuth do app, adicione exatamente estas URLs autorizadas de retorno:
                </p>

                {/* Dev URI */}
                <div className="space-y-1">
                  <span className="text-[11px] text-[#FDBA74]">URL de Desenvolvimento:</span>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-[#151515] border border-[#27272A] px-3 py-2 font-mono text-[11px] text-white">
                    <span className="truncate">{getBaseAppUrl()}{PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].callbackPath}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(`${getBaseAppUrl()}${PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].callbackPath}`, 'dev')}
                      className="text-[#F97316] hover:text-white flex items-center gap-1 shrink-0 font-sans text-xs cursor-pointer"
                    >
                      {copiedKey === 'dev' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'dev' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>

                {/* Shared URI */}
                <div className="space-y-1">
                  <span className="text-[11px] text-[#FDBA74]">URL Compartilhada / Produção:</span>
                  <div className="flex items-center justify-between gap-2 rounded-lg bg-[#151515] border border-[#27272A] px-3 py-2 font-mono text-[11px] text-white">
                    <span className="truncate">{getSharedAppUrl()}{PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].callbackPath}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyText(`${getSharedAppUrl()}${PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].callbackPath}`, 'shared')}
                      className="text-[#F97316] hover:text-white flex items-center gap-1 shrink-0 font-sans text-xs cursor-pointer"
                    >
                      {copiedKey === 'shared' ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedKey === 'shared' ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 3: Environment Variables */}
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5 space-y-2">
                <span className="text-xs font-bold text-[#F97316] block">
                  3. Variáveis de Ambiente Necessárias
                </span>
                <p className="text-slate-300">
                  Adicione as credenciais geradas pelo portal nas variáveis de ambiente do servidor (arquivo .env ou painel Secrets do AI Studio):
                </p>
                <div className="space-y-1.5 font-mono text-[11px]">
                  {PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].envKeys.map((key) => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg bg-[#151515] border border-[#27272A] px-3 py-1.5"
                    >
                      <span className="text-white font-bold">{key}</span>
                      <button
                        type="button"
                        onClick={() => handleCopyText(key, key)}
                        className="text-[#FDBA74] hover:text-white flex items-center gap-1 text-xs cursor-pointer"
                      >
                        {copiedKey === key ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        <span>{copiedKey === key ? 'Copiado' : 'Copiar nome'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 4: Required Scopes */}
              <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5 space-y-2">
                <span className="text-xs font-bold text-[#F97316] block">
                  4. Permissões Solicitadas (Scopes)
                </span>
                <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono text-[11px]">
                  {PLATFORMS_CONFIG_GUIDE[selectedGuidePlatform].scopes.map((s) => (
                    <li key={s} className="truncate">{s}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#27272A]">
              <button
                type="button"
                onClick={() => setSelectedGuidePlatform(null)}
                className="rounded-xl bg-[#F97316] px-5 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
