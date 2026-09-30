import React, { useState, useEffect } from 'react';
import {
  X,
  Play,
  Clock,
  HardDrive,
  Trash2,
  Calendar,
  FileVideo,
  User,
  Scissors,
  Sparkles,
  Save,
  Check,
  Plus,
  Hash,
  Edit3,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { VideoItem } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface VideoPlayerModalProps {
  video: VideoItem | null;
  onClose: () => void;
  onDeleteVideo: (id: string) => void;
  onSaveVideo?: (updatedVideo: VideoItem) => void;
  onOpenSplit?: (video: VideoItem) => void;
  onScheduleVideo?: (video: VideoItem) => void;
  onGenerateAIMetadata?: (video: VideoItem) => void;
}

export const VideoPlayerModal: React.FC<VideoPlayerModalProps> = ({
  video,
  onClose,
  onDeleteVideo,
  onSaveVideo,
  onOpenSplit,
  onScheduleVideo,
  onGenerateAIMetadata,
}) => {
  // Form fields for editing
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Save states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete states
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync inputs whenever modal opens or active video changes
  useEffect(() => {
    if (video) {
      setTitle(video.title || '');
      setDescription(video.description || video.aiMetadata?.description || '');
      const initialTags = Array.isArray(video.hashtags) && video.hashtags.length > 0
        ? video.hashtags
        : Array.isArray(video.aiMetadata?.hashtags)
        ? video.aiMetadata.hashtags
        : [];
      setHashtags(initialTags);
      setSaveSuccess(false);
      setSaveError(null);
    }
  }, [video]);

  if (!video) return null;

  const handleAddHashtag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    if (!newTagInput.trim()) return;

    // Split by spaces or commas to support multiple hashtags like "#podcast #empreendedorismo #marketing"
    const rawTokens = newTagInput.trim().split(/[\s,]+/);
    const validTagsToAdd: string[] = [];

    for (const token of rawTokens) {
      const clean = token.replace(/^[#]+/, '').trim();
      if (clean) {
        const formatted = `#${clean}`;
        if (!hashtags.includes(formatted) && !validTagsToAdd.includes(formatted)) {
          validTagsToAdd.push(formatted);
        }
      }
    }

    if (validTagsToAdd.length > 0) {
      setHashtags([...hashtags, ...validTagsToAdd]);
    }
    setNewTagInput('');
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
  };

  const handleSave = async () => {
    if (!video) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    const updatedVideo: VideoItem = {
      ...video,
      title: title.trim() || video.title,
      description: description.trim(),
      hashtags: hashtags,
    };

    try {
      console.log(`[SALVANDO VÍDEO] Enviando PATCH /api/videos/${video.id}`, {
        title: updatedVideo.title,
        description: updatedVideo.description,
        hashtags: updatedVideo.hashtags,
      });

      const res = await fetch(`/api/videos/${video.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: video.id,
          title: updatedVideo.title,
          description: updatedVideo.description,
          hashtags: updatedVideo.hashtags,
        }),
      });

      console.log(`[RESPOSTA SALVAR VÍDEO] Status HTTP: ${res.status} | Content-Type: ${res.headers.get('content-type')}`);

      if (!res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Aviso do servidor ao salvar vídeo:', errData);
        } else {
          const rawText = await res.text().catch(() => '');
          console.error('[ERRO NÃO-JSON EM SALVAR VÍDEO]:', rawText.slice(0, 300));
        }
      }
    } catch (apiErr) {
      console.warn('Erro de rede ao salvar vídeo no servidor:', apiErr);
    }

    // Persist in React application state and localStorage
    if (onSaveVideo) {
      onSaveVideo(updatedVideo);
    }

    setIsSaving(false);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 3000);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDeleteVideo(video.id);
      setIsConfirmDeleteOpen(false);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-3xl rounded-2xl border border-[#27272A] bg-[#151515] p-6 shadow-2xl z-10 max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F97316]/20 text-[#F97316]">
              <Edit3 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-white truncate max-w-md">
                Detalhes e Edição do Vídeo
              </h2>
              <p className="text-xs text-[#FDBA74]">Visualize, edite título, descrição, hashtags e cortes deste vídeo</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsConfirmDeleteOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition cursor-pointer"
              title="Excluir este vídeo permanentemente"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Excluir vídeo</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Video Player Box */}
        <div className="mt-5 overflow-hidden rounded-xl border border-[#27272A] bg-black shadow-inner flex items-center justify-center relative min-h-[260px] max-h-[420px]">
          {video.videoUrl ? (
            <video
              src={video.videoUrl}
              controls
              autoPlay
              playsInline
              className="w-full max-h-[400px] object-contain"
            />
          ) : (
            <div className="relative w-full h-[320px]">
              <img
                src={video.thumbnail}
                alt={video.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="rounded-full bg-[#F97316] p-4 text-white shadow-xl">
                  <Play className="h-8 w-8 fill-white ml-1" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Metadata Details Bar */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-2.5">
            <span className="text-[10px] font-medium text-[#FDBA74] uppercase tracking-wider">
              Tamanho
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-white tabular-nums">
              <HardDrive className="h-3 w-3 text-[#F97316]" />
              <span>{video.fileSize}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-2.5">
            <span className="text-[10px] font-medium text-[#FDBA74] uppercase tracking-wider">
              Duração
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 font-mono text-xs font-semibold text-white tabular-nums">
              <Clock className="h-3 w-3 text-[#F97316]" />
              <span>{video.duration}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-2.5">
            <span className="text-[10px] font-medium text-[#FDBA74] uppercase tracking-wider">
              Enviado em
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-white">
              <Calendar className="h-3 w-3 text-[#F97316]" />
              <span className="truncate">{video.uploadedAt}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-2.5">
            <span className="text-[10px] font-medium text-[#FDBA74] uppercase tracking-wider">
              Autor
            </span>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-white">
              <User className="h-3 w-3 text-[#F97316]" />
              <span className="truncate">{video.uploadedBy || 'vic102393566@gmail.com'}</span>
            </div>
          </div>
        </div>

        {/* ========================================= */}
        {/* EDITABLE FIELDS: TÍTULO, DESCRIÇÃO, HASHTAGS */}
        {/* ========================================= */}
        <div className="mt-5 space-y-4 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#FDBA74] flex items-center gap-1.5">
              <Edit3 className="h-3.5 w-3.5 text-[#F97316]" />
              Informações editáveis da publicação
            </h3>
            {saveSuccess && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <Check className="h-3 w-3" />
                Alterações salvas!
              </span>
            )}
          </div>

          {/* 1. TÍTULO */}
          <div>
            <label className="block text-xs font-medium text-white mb-1.5">
              Título do vídeo
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Digite o título do vídeo..."
              className="w-full rounded-xl border border-[#27272A] bg-[#151515] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#F97316] focus:outline-none transition"
            />
          </div>

          {/* 2. DESCRIÇÃO */}
          <div>
            <label className="block text-xs font-medium text-white mb-1.5">
              Descrição / Legenda
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Escreva a legenda ou descrição completa do vídeo..."
              className="w-full rounded-xl border border-[#27272A] bg-[#151515] px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:border-[#F97316] focus:outline-none transition resize-none leading-relaxed"
            />
          </div>

          {/* 3. HASHTAGS */}
          <div>
            <label className="block text-xs font-medium text-white mb-1.5 flex items-center gap-1">
              <Hash className="h-3 w-3 text-[#F97316]" />
              Hashtags ({hashtags.length})
            </label>

            {/* List of active hashtags */}
            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#F97316]/30 bg-[#F97316]/10 px-2 py-1 text-[11px] font-medium text-[#FDBA74]"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveHashtag(tag)}
                    className="ml-0.5 rounded text-zinc-400 hover:text-white transition"
                    title="Remover hashtag"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {hashtags.length === 0 && (
                <span className="text-[11px] text-zinc-500 italic py-1">
                  Nenhuma hashtag adicionada ainda.
                </span>
              )}
            </div>

            {/* Input to add new hashtag */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={handleAddHashtag}
                  placeholder="Adicionar hashtag (ex: clipo, shorts, viral)..."
                  className="w-full rounded-xl border border-[#27272A] bg-[#151515] px-3.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-[#F97316] focus:outline-none transition"
                />
              </div>
              <button
                type="button"
                onClick={handleAddHashtag}
                className="flex items-center gap-1 rounded-xl border border-[#27272A] bg-[#151515] px-3 py-1.5 text-xs font-medium text-white hover:border-[#F97316] hover:text-[#F97316] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          {/* Salvar Button inside edit card */}
          <div className="flex items-center justify-end pt-2 border-t border-[#27272A]/60">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-600/25 hover:bg-emerald-500 transition active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : saveSuccess ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Salvo com sucesso!</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Salvar título, descrição e hashtags</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[#27272A] pt-4">
          <button
            onClick={() => setIsConfirmDeleteOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Excluir vídeo</span>
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {/* CORTE AUTOMÁTICO */}
            {onOpenSplit && (
              <button
                onClick={() => {
                  const targetVideo: VideoItem = {
                    ...video,
                    title: title.trim() || video.title,
                    description: description.trim(),
                    hashtags: hashtags,
                  };
                  onClose();
                  onOpenSplit(targetVideo);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[#F97316]/50 bg-[#F97316]/10 px-3.5 py-2 text-xs font-semibold text-[#F97316] hover:bg-[#F97316]/20 transition active:scale-[0.98]"
                title="Dividir este vídeo com cortes automáticos de 30s, 1m, 3m, 5m ou personalizado"
              >
                <Scissors className="h-3.5 w-3.5" />
                <span>Corte automático</span>
              </button>
            )}

            {onGenerateAIMetadata && (
              <button
                onClick={() => {
                  const targetVideo: VideoItem = {
                    ...video,
                    title: title.trim() || video.title,
                    description: description.trim(),
                    hashtags: hashtags,
                  };
                  onClose();
                  onGenerateAIMetadata(targetVideo);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs font-semibold text-white hover:border-[#F97316] hover:text-[#F97316] transition active:scale-[0.98]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#F97316]" />
                <span>Gerar com IA</span>
              </button>
            )}

            {onScheduleVideo && (
              <button
                onClick={() => {
                  const targetVideo: VideoItem = {
                    ...video,
                    title: title.trim() || video.title,
                    description: description.trim(),
                    hashtags: hashtags,
                  };
                  onClose();
                  onScheduleVideo(targetVideo);
                }}
                className="flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98]"
              >
                <Calendar className="h-3.5 w-3.5" />
                <span>Agendar</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      {/* In-App Confirmation Modal (Does not depend on window.confirm) */}
      <ConfirmDeleteModal
        isOpen={isConfirmDeleteOpen}
        videoTitle={video.title}
        isDeleting={isDeleting}
        onCancel={() => setIsConfirmDeleteOpen(false)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
