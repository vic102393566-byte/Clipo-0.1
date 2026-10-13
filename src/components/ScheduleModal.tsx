import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Clock,
  Share2,
  FileText,
  Film,
  Sparkles,
  Check,
  AlertCircle,
  Loader2,
  Tag,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { ScheduledPublication, SocialPlatform, VideoItem, AIMetadata } from '../types';

interface ScheduleModalProps {
  isOpen: boolean;
  video: VideoItem | null;
  availableVideos: VideoItem[];
  onClose: () => void;
  onScheduleSubmit: (newPub: ScheduledPublication) => void;
}

const PLATFORM_OPTIONS: { id: SocialPlatform; name: string; iconColor: string }[] = [
  { id: 'tiktok', name: 'TikTok', iconColor: 'text-cyan-400' },
  { id: 'instagram', name: 'Instagram Reels', iconColor: 'text-pink-400' },
  { id: 'youtube', name: 'YouTube Shorts', iconColor: 'text-red-400' },
  { id: 'linkedin', name: 'LinkedIn Video', iconColor: 'text-sky-400' },
];

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  isOpen,
  video,
  availableVideos,
  onClose,
  onScheduleSubmit,
}) => {
  const [selectedVideoId, setSelectedVideoId] = useState<string>('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([
    'tiktok',
    'instagram',
  ]);
  const [scheduledDate, setScheduledDate] = useState('2026-09-24');
  const [scheduledTime, setScheduledTime] = useState('18:00');
  
  // Editable fields (Requisitos 1, 2, 3, 4)
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [callToAction, setCallToAction] = useState('');
  const [newHashtagInput, setNewHashtagInput] = useState('');

  // AI Generation State
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [aiMetadataState, setAiMetadataState] = useState<AIMetadata | null>(null);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Synchronize state when modal opens or video changes
  useEffect(() => {
    const activeVideo = video || (availableVideos.length > 0 ? availableVideos[0] : null);
    if (activeVideo) {
      setSelectedVideoId(activeVideo.id);
      
      // If video already has AI metadata attached, prefill directly
      if (activeVideo.aiMetadata) {
        setTitle(activeVideo.aiMetadata.title || activeVideo.title);
        setCaption(activeVideo.aiMetadata.description || '');
        setHashtags(activeVideo.aiMetadata.hashtags || []);
        setCallToAction(activeVideo.aiMetadata.callToAction || '');
        setAiGenerated(true);
        setAiMetadataState(activeVideo.aiMetadata);
      } else {
        setTitle(activeVideo.title);
        setCaption(`Confira este corte exclusivo: ${activeVideo.title}`);
        setHashtags(['#clipo', '#shorts', '#viral']);
        setCallToAction('Comente o que achou e compartilhe com quem precisa ver isso!');
        setAiGenerated(false);
        setAiMetadataState(null);
      }
    }
  }, [video, availableVideos, isOpen]);

  if (!isOpen) return null;

  // Selected video object
  const currentVideo =
    availableVideos.find((v) => v.id === selectedVideoId) || video || availableVideos[0];

  const togglePlatform = (p: SocialPlatform) => {
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length > 1) {
        setSelectedPlatforms(selectedPlatforms.filter((item) => item !== p));
      } else {
        setErrorMsg('Selecione pelo menos uma plataforma para agendamento.');
      }
    } else {
      setErrorMsg(null);
      setSelectedPlatforms([...selectedPlatforms, p]);
    }
  };

  const handleVideoSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const vId = e.target.value;
    setSelectedVideoId(vId);
    const target = availableVideos.find((v) => v.id === vId);
    if (target) {
      if (target.aiMetadata) {
        setTitle(target.aiMetadata.title || target.title);
        setCaption(target.aiMetadata.description || '');
        setHashtags(target.aiMetadata.hashtags || []);
        setCallToAction(target.aiMetadata.callToAction || '');
        setAiGenerated(true);
        setAiMetadataState(target.aiMetadata);
      } else {
        setTitle(target.title);
        setCaption(`Confira este corte exclusivo: ${target.title}`);
        setHashtags(['#clipo', '#shorts', '#viral']);
        setCallToAction('Comente o que achou e compartilhe!');
        setAiGenerated(false);
        setAiMetadataState(null);
      }
    }
  };

  // Trigger server-side Gemini AI generation
  const handleGenerateWithAI = async () => {
    if (!currentVideo) return;
    setIsGeneratingAI(true);
    setAiError(null);

    try {
      const response = await fetch('/api/ai/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: currentVideo.id,
          title: title || currentVideo.title,
          duration: currentVideo.duration,
          thumbnail: currentVideo.thumbnail,
          videoUrl: currentVideo.videoUrl,
          platforms: selectedPlatforms,
          model: 'gemini-3.8-flash',
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${response.status} ao conectar com a IA.`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Não foi possível gerar informações.');
      }

      const { title: aiTitle, description, hashtags: aiTags, callToAction: aiCTA, modelUsed, generatedAt } = result.data;
      setTitle(aiTitle || currentVideo.title);
      setCaption(description || '');
      setHashtags(Array.isArray(aiTags) ? aiTags : ['#clipo', '#shorts']);
      setCallToAction(aiCTA || '');
      setAiGenerated(true);
      setAiMetadataState({
        title: aiTitle,
        description,
        hashtags: aiTags,
        callToAction: aiCTA,
        modelUsed,
        generatedAt,
      });
    } catch (err: any) {
      console.error('Erro na geração com IA:', err);
      setAiError(err.message || 'Falha ao gerar textos com IA. Tente novamente.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleAddHashtag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = newHashtagInput.trim().replace(/\s+/g, '');
    if (!clean) return;
    const formatted = clean.startsWith('#') ? clean : `#${clean}`;
    if (!hashtags.includes(formatted)) {
      setHashtags([...hashtags, formatted]);
    }
    setNewHashtagInput('');
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter((t) => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentVideo) {
      setErrorMsg('Por favor, selecione um vídeo para agendar.');
      return;
    }
    if (selectedPlatforms.length === 0) {
      setErrorMsg('Selecione pelo menos uma plataforma.');
      return;
    }
    if (!scheduledDate) {
      setErrorMsg('Selecione uma data para a publicação.');
      return;
    }
    if (!scheduledTime) {
      setErrorMsg('Selecione um horário.');
      return;
    }

    // Format human readable label (e.g., "24 Set")
    const dateParts = scheduledDate.split('-');
    let dateLabel = scheduledDate;
    if (dateParts.length === 3) {
      const day = dateParts[2];
      const monthNames = [
        'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
        'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
      ];
      const mIdx = parseInt(dateParts[1], 10) - 1;
      dateLabel = `${day} ${monthNames[mIdx] || 'Set'}`;
    }

    // Assemble description with CTA and hashtags if not already merged
    let finalDescription = caption.trim() || 'Sem legenda configurada';
    if (callToAction && !finalDescription.includes(callToAction)) {
      finalDescription = `${finalDescription}\n\n${callToAction}`;
    }
    if (hashtags.length > 0 && !finalDescription.includes(hashtags[0])) {
      finalDescription = `${finalDescription}\n\n${hashtags.join(' ')}`;
    }

    const newPublication: ScheduledPublication = {
      id: `pub-${Date.now()}`,
      userId: currentVideo.userId,
      videoId: currentVideo.id,
      videoUrl: currentVideo.videoUrl,
      storagePath: currentVideo.storagePath,
      title: title.trim() || currentVideo.title,
      description: finalDescription,
      thumbnail: currentVideo.thumbnail,
      duration: currentVideo.duration,
      scheduledTime: scheduledTime,
      scheduledDateLabel: dateLabel,
      dateISO: scheduledDate,
      platforms: selectedPlatforms,
      status: 'agendado',
      aspectRatio: '9:16',
      fileSize: currentVideo.fileSize,
      hashtags: hashtags,
      callToAction: callToAction,
      aiMetadata: aiMetadataState || undefined,
      createdAt: new Date().toISOString(),
    };

    onScheduleSubmit(newPublication);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Agendar Publicação</h2>
              <p className="text-xs text-[#FDBA74]">
                Defina plataforma, data, textos gerados com IA e chamada para o público
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Video Selection */}
          <div>
            {video ? (
              <div className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="h-12 w-12 rounded-lg object-cover bg-black border border-[#27272A]"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">{video.title}</p>
                  <p className="text-[11px] text-[#FDBA74] font-mono">
                    {video.duration} · {video.fileSize}
                  </p>
                </div>
              </div>
            ) : (
              <select
                value={selectedVideoId}
                onChange={handleVideoSelectChange}
                className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white focus:border-[#F97316] focus:outline-none"
              >
                {availableVideos.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} ({v.duration})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 1. TÍTULO (REQUISITO 1) */}
          <div>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da publicação..."
              className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs text-white focus:border-[#F97316] focus:outline-none"
            />
          </div>

          {/* 2. DESCRIÇÃO / LEGENDA (REQUISITO 2) */}
          <div>
            <label className="text-xs font-semibold text-[#FDBA74] flex items-center gap-1.5 mb-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-[#F97316]" />
              <span>Descrição do conteúdo</span>
            </label>
            <textarea
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Escreva a legenda..."
              className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* 3. HASHTAGS RELEVANTES (REQUISITO 3) */}
          <div>
            <label className="text-xs font-semibold text-[#FDBA74] flex items-center gap-1.5 mb-1.5">
              <Tag className="h-3.5 w-3.5 text-[#F97316]" />
              <span>Hashtags ({hashtags.length})</span>
            </label>

            <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] min-h-[40px] items-center">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#F97316]/15 border border-[#F97316]/30 px-2.5 py-1 text-[11px] font-mono font-medium text-white"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveHashtag(tag)}
                    className="text-[#FDBA74] hover:text-white cursor-pointer ml-0.5"
                  >
                    ×
                  </button>
                </span>
              ))}

              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="text"
                  value={newHashtagInput}
                  onChange={(e) => setNewHashtagInput(e.target.value)}
                  onKeyDown={handleAddHashtag}
                  placeholder="+ tag..."
                  className="w-20 rounded-md border border-[#27272A] bg-[#151515] px-2 py-0.5 text-[11px] text-white focus:border-[#F97316] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddHashtag}
                  className="rounded bg-[#27272A] px-1.5 py-0.5 text-[11px] text-white hover:bg-[#F97316] transition cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* 4. SUGESTÃO DE CHAMADA PARA O PÚBLICO - CTA (REQUISITO 4) */}
          <div>
            <label className="text-xs font-semibold text-[#FDBA74] flex items-center gap-1.5 mb-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#F97316]" />
              <span>Sugestão de chamada para o público (CTA)</span>
            </label>
            <input
              type="text"
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              placeholder="Ex: Salve este vídeo e comente sua opinião..."
              className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2 text-xs text-white focus:border-[#F97316] focus:outline-none"
            />
          </div>

          {/* Platform Picker */}
          <div>
            <label className="text-xs font-semibold text-[#FDBA74] flex items-center gap-1.5 mb-1.5">
              <Share2 className="h-3.5 w-3.5 text-[#F97316]" />
              <span>Escolher plataformas</span>
            </label>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PLATFORM_OPTIONS.map((p) => {
                const isSelected = selectedPlatforms.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => togglePlatform(p.id)}
                    className={`flex items-center justify-between rounded-xl border p-2.5 text-xs font-medium transition cursor-pointer ${
                      isSelected
                        ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                        : 'border-[#27272A] bg-[#0A0A0A] text-[#FDBA74] hover:border-[#F97316]/40 hover:text-white'
                    }`}
                  >
                    <span className={p.iconColor}>{p.name}</span>
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded border ${
                        isSelected
                          ? 'border-[#F97316] bg-[#F97316] text-white'
                          : 'border-[#27272A] bg-transparent'
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date and Time Picking */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-[#FDBA74] flex items-center gap-1.5 mb-1.5">
                <Calendar className="h-3.5 w-3.5 text-[#F97316]" />
                <span>Escolher data</span>
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3 py-2 text-xs text-white focus:border-[#F97316] focus:outline-none [color-scheme:dark]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#FDBA74] flex items-center gap-1.5 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-[#F97316]" />
                <span>Escolher horário</span>
              </label>
              <input
                type="time"
                required
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3 py-2 text-xs text-white focus:border-[#F97316] focus:outline-none [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Actions Footer */}
          <div className="mt-4 flex items-center justify-end gap-3 border-t border-[#27272A] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] cursor-pointer"
            >
              <Calendar className="h-4 w-4" />
              <span>Agendar publicação</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
