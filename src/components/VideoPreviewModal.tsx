import React, { useState, useEffect, useRef } from 'react';
import { X, Play, Clock, Share2, Sparkles, CheckCircle2, Calendar, AlertCircle, RefreshCw } from 'lucide-react';
import { ScheduledPublication, VideoItem } from '../types';
import { StatusBadge } from './StatusBadge';
import { useI18n } from '../i18n/I18nContext';
import { createSignedVideoUrl, currentStorageProvider } from '../services/storageService';

interface VideoPreviewModalProps {
  publication: ScheduledPublication | null;
  availableVideos?: VideoItem[];
  onClose: () => void;
  onPublishNow: (id: string) => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  publication,
  availableVideos = [],
  onClose,
  onPublishNow,
}) => {
  const { t, language } = useI18n();
  const isEn = language === 'en-US';

  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  const [isLoadingUrl, setIsLoadingUrl] = useState<boolean>(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Efeito para resolver ou renovar a URL do vídeo
  useEffect(() => {
    let isCancelled = false;

    async function resolveUrl() {
      if (!publication) {
        setResolvedVideoUrl(null);
        setIsLoadingUrl(false);
        setPlaybackError(null);
        return;
      }

      setIsLoadingUrl(true);
      setPlaybackError(null);
      setIsPlaying(false);

      try {
        // 1. Tenta identificar se já temos uma URL válida na publicação
        let candidateUrl = publication.videoUrl || null;
        let storagePath = publication.storagePath || null;
        const videoId = publication.videoId;

        // 2. Se a publicação não tiver storagePath ou videoUrl, busca no vídeo original da biblioteca
        if (videoId && (!candidateUrl || !storagePath)) {
          const matchedOriginal = availableVideos.find((v) => v.id === videoId);
          if (matchedOriginal) {
            if (!storagePath && matchedOriginal.storagePath) {
              storagePath = matchedOriginal.storagePath;
            }
            if (!candidateUrl && matchedOriginal.videoUrl) {
              candidateUrl = matchedOriginal.videoUrl;
            }
          }
        }

        // 3. Se temos storagePath, sempre tentamos garantir uma URL assinada recente para evitar expiração
        if (storagePath) {
          try {
            const freshSigned = await createSignedVideoUrl(storagePath, 86400);
            if (freshSigned && !isCancelled) {
              candidateUrl = freshSigned;
            }
          } catch (signErr) {
            console.warn('[VideoPreviewModal] Não foi possível renovar URL assinada direta:', signErr);
          }
        }

        // 4. Se ainda não temos URL e temos videoId/storagePath, recorre ao currentStorageProvider
        if (!candidateUrl && (videoId || storagePath)) {
          try {
            const providerUrl = await currentStorageProvider.getVideoUrl(videoId || publication.id, storagePath || undefined);
            if (providerUrl && !isCancelled) {
              candidateUrl = providerUrl;
            }
          } catch (provErr) {
            console.warn('[VideoPreviewModal] Erro ao buscar URL via StorageProvider:', provErr);
          }
        }

        if (isCancelled) return;

        if (candidateUrl) {
          setResolvedVideoUrl(candidateUrl);
          setPlaybackError(null);
        } else {
          setResolvedVideoUrl(null);
          setPlaybackError(
            isEn
              ? 'Video media file not found or not yet processed in storage.'
              : 'Arquivo de vídeo não encontrado ou ainda não sincronizado no armazenamento.'
          );
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error('[VideoPreviewModal] Falha ao resolver vídeo para exibição:', err);
          setPlaybackError(
            isEn
              ? 'Failed to obtain authorized playback URL.'
              : 'Falha ao obter URL autorizada de reprodução.'
          );
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingUrl(false);
        }
      }
    }

    resolveUrl();

    return () => {
      isCancelled = true;
    };
  }, [publication, availableVideos, isEn]);

  // Handler para recarregar manualmente caso dê erro
  const handleRetryPlayback = async () => {
    if (!publication) return;
    setIsLoadingUrl(true);
    setPlaybackError(null);
    try {
      const storagePath = publication.storagePath || availableVideos.find((v) => v.id === publication.videoId)?.storagePath;
      if (storagePath) {
        const fresh = await createSignedVideoUrl(storagePath, 86400);
        if (fresh) {
          setResolvedVideoUrl(fresh);
          return;
        }
      }
      setPlaybackError(
        isEn
          ? 'Could not refresh the playback session. Please check your network or try again later.'
          : 'Não foi possível renovar a sessão de reprodução. Verifique sua conexão e tente novamente.'
      );
    } catch {
      setPlaybackError(
        isEn ? 'Playback renewal error.' : 'Erro ao renovar reprodução.'
      );
    } finally {
      setIsLoadingUrl(false);
    }
  };

  const handleStartPlay = () => {
    setIsPlaying(true);
    if (videoRef.current) {
      videoRef.current.play().catch((err) => {
        console.warn('[VideoPreviewModal] Auto-play impedido pelo navegador:', err);
      });
    }
  };

  if (!publication) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-2xl rounded-2xl border border-[#27272A] bg-[#151515] p-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              {isEn ? 'Video Preview' : 'Pré-visualização do vídeo'}
            </h2>
            <p className="text-xs text-[#FDBA74]">
              {isEn ? 'Review channels, layout, and copy prior to scheduled dispatch' : 'Verifique os canais e o formato antes do disparo'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: 9:16 Video Player / Mockup */}
          <div className="relative aspect-[9/16] w-full max-w-[260px] mx-auto overflow-hidden rounded-2xl border border-[#27272A] bg-black shadow-lg flex items-center justify-center">
            {isLoadingUrl ? (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <RefreshCw className="h-7 w-7 text-[#F97316] animate-spin mb-2" />
                <p className="text-xs text-[#FDBA74]">
                  {isEn ? 'Loading video stream...' : 'Carregando stream de vídeo...'}
                </p>
              </div>
            ) : resolvedVideoUrl && !playbackError ? (
              <>
                <video
                  ref={videoRef}
                  src={resolvedVideoUrl}
                  controls={isPlaying}
                  playsInline
                  poster={publication.thumbnail}
                  preload="metadata"
                  className="h-full w-full object-contain bg-black"
                  onPlay={() => setIsPlaying(true)}
                  onError={() => {
                    setPlaybackError(
                      isEn
                        ? 'Video stream could not be loaded. URL may have expired.'
                        : 'O fluxo de vídeo não pôde ser carregado. A URL pode ter expirado.'
                    );
                    setIsPlaying(false);
                  }}
                />

                {!isPlaying && (
                  <div
                    className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                    onClick={handleStartPlay}
                  >
                    <button
                      type="button"
                      aria-label={isEn ? 'Play video' : 'Reproduzir vídeo'}
                      className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F97316] text-white shadow-xl shadow-[#F97316]/40 backdrop-blur-sm hover:scale-105 transition cursor-pointer"
                    >
                      <Play className="h-6 w-6 fill-white ml-0.5" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center">
                <AlertCircle className="h-8 w-8 text-amber-500 mb-2" />
                <p className="text-xs text-white font-medium mb-1">
                  {isEn ? 'Preview Unavailable' : 'Vídeo indisponível'}
                </p>
                <p className="text-[11px] text-[#FDBA74] mb-3">
                  {playbackError || (isEn ? 'Media file not linked.' : 'Arquivo de mídia não vinculado.')}
                </p>
                <button
                  type="button"
                  onClick={handleRetryPlayback}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#27272A] bg-[#0A0A0A] text-xs text-white hover:bg-neutral-800 transition cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>{isEn ? 'Retry' : 'Tentar novamente'}</span>
                </button>
              </div>
            )}

            {/* Video overlay badges */}
            <div className="absolute top-3 left-3 rounded-lg bg-black/70 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white backdrop-blur-sm border border-[#27272A] pointer-events-none">
              9:16 · {publication.duration}
            </div>

            {!isPlaying && (
              <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/80 p-2.5 backdrop-blur-sm border border-[#27272A] pointer-events-none">
                <p className="text-xs font-semibold text-white truncate">{publication.title}</p>
                <p className="text-[10px] text-[#FDBA74] line-clamp-2 mt-0.5">{publication.description}</p>
              </div>
            )}
          </div>

          {/* Right: Details & Schedule Configuration */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                    {isEn ? 'Title' : 'Título'}
                  </span>
                  <StatusBadge status={publication.status} />
                </div>
                <h3 className="mt-1 text-sm font-semibold text-white">{publication.title}</h3>
                {publication.errorMessage && (
                  <p className="mt-1 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                    {isEn ? 'Dispatch error:' : 'Erro no envio:'} {publication.errorMessage}
                  </p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                  {isEn ? 'Scheduled Caption' : 'Legenda programada'}
                </span>
                <p className="mt-1 text-xs text-white leading-relaxed bg-[#0A0A0A] p-3 rounded-xl border border-[#27272A]">
                  {publication.description}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                  {isEn ? 'Target Channels' : 'Canais de destino'}
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {publication.platforms.map((p) => {
                    const platformResult = publication.platformResults?.find((r) => r.platform === p);
                    return (
                      <div
                        key={p}
                        title={platformResult?.error || (platformResult?.success ? 'Publicado com sucesso' : undefined)}
                        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs capitalize ${
                          platformResult
                            ? platformResult.success
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                            : 'border-[#27272A] bg-[#0A0A0A] text-white'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            platformResult
                              ? platformResult.success
                                ? 'bg-emerald-400'
                                : 'bg-rose-400'
                              : 'bg-[#F97316]'
                          }`}
                        />
                        <span>{p}</span>
                        {platformResult && (
                          <span className="text-[10px] opacity-80">
                            {platformResult.success ? '✓' : '✕'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                  {isEn ? 'Publishing Schedule' : 'Horário de postagem'}
                </span>
                <div className="mt-1.5 flex items-center gap-2 text-xs font-mono text-white tabular-nums">
                  <Clock className="h-4 w-4 text-[#F97316]" />
                  <span>
                    {publication.scheduledDateLabel}, {isEn ? 'at' : 'às'} {publication.scheduledTime}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="border-t border-[#27272A] pt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  onPublishNow(publication.id);
                  onClose();
                }}
                className="flex-1 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#F97316]/30 hover:bg-[#EA580C] transition cursor-pointer"
              >
                {isEn ? 'Publish Now' : 'Publicar agora'}
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition cursor-pointer"
              >
                {t.common.close}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

