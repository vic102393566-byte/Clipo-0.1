import React, { useState } from 'react';
import { Film, Upload, Search, Play, Eye, Trash2, Scissors, Calendar, Sparkles, Edit3 } from 'lucide-react';
import { VideoItem } from '../../types';
import { ConfirmDeleteModal } from '../ConfirmDeleteModal';

interface VideosViewProps {
  videos: VideoItem[];
  onOpenUpload: () => void;
  onPreviewVideo: (item: VideoItem) => void;
  onEditVideo?: (item: VideoItem) => void;
  onDeleteVideo: (id: string) => void;
  onSplitVideo?: (item: VideoItem) => void;
  onScheduleVideo?: (item: VideoItem) => void;
  onGenerateAIMetadata?: (item: VideoItem) => void;
  isOverLimit?: boolean;
  onUpgradeClick?: () => void;
  planName?: string;
  limitFormatted?: string;
}

export const VideosView: React.FC<VideosViewProps> = ({
  videos,
  onOpenUpload,
  onPreviewVideo,
  onEditVideo,
  onDeleteVideo,
  onSplitVideo,
  onScheduleVideo,
  onGenerateAIMetadata,
  isOverLimit,
  onUpgradeClick,
  planName = 'Pro',
  limitFormatted = '50 GB',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [videoPendingDelete, setVideoPendingDelete] = useState<VideoItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = videos.filter((v) =>
    v.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleConfirmDelete = async () => {
    if (!videoPendingDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteVideo(videoPendingDelete.id);
      setVideoPendingDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Meus vídeos</h2>
            <span className="font-mono text-xs tabular-nums text-slate-400">
              ({videos.length} disponíveis)
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Biblioteca de vídeos enviados, cortes prontos e mídias para publicação
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#FDBA74]" />
            <input
              type="text"
              placeholder="Filtrar vídeos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="rounded-xl border border-[#27272A] bg-[#151515] pl-9 pr-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none"
            />
          </div>
          <button
            onClick={onOpenUpload}
            className="flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition shadow-md shadow-[#F97316]/25"
          >
            <Upload className="h-4 w-4" />
            <span>Enviar vídeo</span>
          </button>
        </div>
      </div>

      {/* Storage Limit Warning Banner */}
      {isOverLimit && (
        <div className="flex items-center justify-between rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
          <div>
            <span className="font-semibold text-rose-100">Armazenamento esgotado ({limitFormatted}):</span>
            <span className="ml-1 text-rose-300">
              Faça upgrade para o plano Pro ou Premium na aba "Meu plano" para continuar enviando vídeos ou dividindo partes.
            </span>
          </div>
          {onUpgradeClick && (
            <button
              onClick={onUpgradeClick}
              className="ml-3 shrink-0 rounded-lg bg-[#F97316] px-3 py-1 font-semibold text-white hover:bg-[#EA580C] transition"
            >
              Fazer upgrade
            </button>
          )}
        </div>
      )}

      {/* Videos Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#27272A] bg-[#151515] p-12 text-center">
          <Film className="mx-auto h-10 w-10 text-[#FDBA74] mb-3" />
          <h3 className="text-sm font-semibold text-white">Nenhum vídeo encontrado</h3>
          <p className="mt-1 text-xs text-[#FDBA74] max-w-sm mx-auto">
            {searchTerm
              ? 'Nenhum vídeo corresponde à busca. Tente outro termo.'
              : 'Você ainda não enviou nenhum vídeo. Comece enviando seu primeiro arquivo MP4, MOV ou WebM.'}
          </p>
          <button
            onClick={onOpenUpload}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white hover:bg-[#EA580C] transition"
          >
            <Upload className="h-4 w-4" />
            <span>Enviar primeiro vídeo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((video) => (
            <div
              key={video.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[#27272A] bg-[#151515] transition hover:border-[#F97316]/50"
            >
              {/* Top Media Preview */}
              <div
                onClick={() => onPreviewVideo(video)}
                className="relative aspect-video w-full cursor-pointer overflow-hidden bg-black"
              >
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F97316] text-white shadow-lg">
                    <Play className="h-5 w-5 fill-white ml-0.5" />
                  </div>
                </div>

                <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-white">
                  {video.duration}
                </span>
                <span className="absolute top-2 left-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[10px] text-slate-200">
                  {video.fileSize}
                </span>

                {/* Direct Trash Button on Thumbnail */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setVideoPendingDelete(video);
                  }}
                  className="absolute top-2 right-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-rose-400 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 hover:bg-rose-600 hover:text-white transition shadow"
                  title="Excluir vídeo"
                  aria-label={`Excluir vídeo ${video.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Video Meta */}
              <div className="p-4">
                <h3
                  onClick={() => onPreviewVideo(video)}
                  className="cursor-pointer truncate text-sm font-semibold text-white group-hover:text-[#A78BFA] transition"
                  title={video.title}
                >
                  {video.title}
                </h3>

                {/* Zero-Pill unboxed metadata */}
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[#FDBA74]">
                  <span>{video.uploadedAt}</span>
                  <span aria-hidden="true" className="text-zinc-600">·</span>
                  <span className="font-mono tabular-nums text-white">
                    {video.fileSize}
                  </span>
                  <span aria-hidden="true" className="text-zinc-600">·</span>
                  <span className="text-emerald-400">Pronto</span>
                </div>

                {/* Actions footer: Visualizar, Dividir, Agendar & Excluir */}
                <div className="mt-4 flex items-center justify-between border-t border-[#27272A] pt-3 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onPreviewVideo(video)}
                      className="flex items-center gap-1.5 font-medium text-white hover:text-[#A78BFA] transition"
                    >
                      <Eye className="h-3.5 w-3.5 text-[#F97316]" />
                      <span>Ver</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onEditVideo) onEditVideo(video);
                        else onPreviewVideo(video);
                      }}
                      className="flex items-center gap-1 font-medium text-[#F97316] hover:text-[#EA580C] transition cursor-pointer"
                      title="Editar título, descrição, hashtags e cortes deste vídeo"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Editar</span>
                    </button>

                    {onGenerateAIMetadata && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onGenerateAIMetadata(video);
                        }}
                        className="flex items-center gap-1 font-medium text-[#F97316] hover:text-[#EA580C] transition cursor-pointer"
                        title="Gerar título, descrição, hashtags e CTA com IA"
                      >
                        <Sparkles className="h-3 w-3" />
                        <span>Gerar com IA</span>
                      </button>
                    )}

                    {onSplitVideo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSplitVideo(video);
                        }}
                        className="flex items-center gap-1 font-medium text-[#F97316] hover:text-[#A78BFA] transition"
                        title="Dividir este vídeo em partes menores"
                      >
                        <Scissors className="h-3 w-3" />
                        <span>Dividir</span>
                      </button>
                    )}

                    {onScheduleVideo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onScheduleVideo(video);
                        }}
                        className="flex items-center gap-1 font-medium text-emerald-400 hover:text-emerald-300 transition"
                        title="Agendar publicação deste vídeo"
                      >
                        <Calendar className="h-3 w-3" />
                        <span>Agendar</span>
                      </button>
                    )}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setVideoPendingDelete(video);
                    }}
                    className="flex items-center gap-1.5 font-medium text-rose-400 hover:text-rose-300 transition px-2.5 py-1 rounded-lg hover:bg-rose-500/15 cursor-pointer"
                    title="Excluir vídeo"
                    aria-label={`Excluir ${video.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Excluir</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* In-App Confirmation Modal (Does not depend on window.confirm) */}
      <ConfirmDeleteModal
        isOpen={videoPendingDelete !== null}
        videoTitle={videoPendingDelete?.title || ''}
        isDeleting={isDeleting}
        onCancel={() => setVideoPendingDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};

