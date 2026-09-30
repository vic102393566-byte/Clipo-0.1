import React from 'react';
import { X, Play, Clock, Share2, Sparkles, CheckCircle2, Calendar } from 'lucide-react';
import { ScheduledPublication } from '../types';
import { StatusBadge } from './StatusBadge';

interface VideoPreviewModalProps {
  publication: ScheduledPublication | null;
  onClose: () => void;
  onPublishNow: (id: string) => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  publication,
  onClose,
  onPublishNow,
}) => {
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
            <h2 className="text-base font-semibold text-white">Pré-visualização do vídeo</h2>
            <p className="text-xs text-[#FDBA74]">Verifique os canais e o formato antes do disparo</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: 9:16 Video Mockup */}
          <div className="relative aspect-[9/16] w-full max-w-[260px] mx-auto overflow-hidden rounded-2xl border border-[#27272A] bg-black shadow-lg">
            <img
              src={publication.thumbnail}
              alt={publication.title}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            {/* Center Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F97316] text-white shadow-xl shadow-[#F97316]/40 backdrop-blur-sm hover:scale-105 transition cursor-pointer">
                <Play className="h-6 w-6 fill-white ml-0.5" />
              </div>
            </div>

            {/* Video overlay badges */}
            <div className="absolute top-3 left-3 rounded-lg bg-black/70 px-2 py-0.5 font-mono text-[10px] tabular-nums text-white backdrop-blur-sm border border-[#27272A]">
              9:16 · {publication.duration}
            </div>

            <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-black/80 p-2.5 backdrop-blur-sm border border-[#27272A]">
              <p className="text-xs font-semibold text-white truncate">{publication.title}</p>
              <p className="text-[10px] text-[#FDBA74] line-clamp-2 mt-0.5">{publication.description}</p>
            </div>
          </div>

          {/* Right: Details & Schedule Configuration */}
          <div className="flex flex-col justify-between space-y-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                    Título
                  </span>
                  <StatusBadge status={publication.status} />
                </div>
                <h3 className="mt-1 text-sm font-semibold text-white">{publication.title}</h3>
                {publication.errorMessage && (
                  <p className="mt-1 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-2 rounded-lg">
                    Erro no envio: {publication.errorMessage}
                  </p>
                )}
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                  Legenda programada
                </span>
                <p className="mt-1 text-xs text-white leading-relaxed bg-[#0A0A0A] p-3 rounded-xl border border-[#27272A]">
                  {publication.description}
                </p>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                  Canais de destino
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {publication.platforms.map((p) => (
                    <div
                      key={p}
                      className="flex items-center gap-1.5 rounded-lg border border-[#27272A] bg-[#0A0A0A] px-2.5 py-1 text-xs text-white capitalize"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F97316]" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-medium uppercase tracking-wider text-[#FDBA74]">
                  Horário de postagem
                </span>
                <div className="mt-1.5 flex items-center gap-2 text-xs font-mono text-white tabular-nums">
                  <Clock className="h-4 w-4 text-[#F97316]" />
                  <span>{publication.scheduledDateLabel}, às {publication.scheduledTime} (Horário de Brasília)</span>
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
                className="flex-1 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#F97316]/30 hover:bg-[#EA580C] transition"
              >
                Publicar agora
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
