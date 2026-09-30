import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  Clock,
  RotateCcw,
  Check,
  Copy,
  Calendar,
  AlertCircle,
  Loader2,
  Tag,
  MessageSquare,
  FileText,
  Sliders,
  ChevronDown
} from 'lucide-react';
import { VideoItem, AIMetadata, SocialPlatform } from '../types';

interface AIMetadataModalProps {
  isOpen: boolean;
  video: VideoItem | null;
  onClose: () => void;
  onSaveToVideo: (videoId: string, updatedTitle: string, aiData: AIMetadata) => void;
  onScheduleWithAI: (video: VideoItem, aiData: AIMetadata) => void;
}

export const AI_MODELS_OPTIONS = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash (Recomendado)',
    badge: 'Mais rápido e balanceado',
    desc: 'Otimizado para retenção e algoritmos de vídeos curtos.',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra rápido',
    desc: 'Ideal para gerações instantâneas de alta frequência.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    name: 'Gemini 3.1 Pro',
    badge: 'Raciocínio avançado',
    desc: 'Profundidade máxima em copy persuasivo e nichos técnicos.',
  },
];

export const TONE_OPTIONS = [
  { id: 'viral', label: 'Viral & Engajador' },
  { id: 'educativo', label: 'Educativo & Didático' },
  { id: 'persuasivo', label: 'Persuasivo & Vendas' },
  { id: 'minimalista', label: 'Minimalista & Direto' },
];

export const AIMetadataModal: React.FC<AIMetadataModalProps> = ({
  isOpen,
  video,
  onClose,
  onSaveToVideo,
  onScheduleWithAI,
}) => {
  // Model and prompt configuration
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.8-flash');
  const [selectedTone, setSelectedTone] = useState<string>('viral');
  const [promptNotes, setPromptNotes] = useState<string>('');
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Editable generated fields
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [generatedHashtags, setGeneratedHashtags] = useState<string[]>([]);
  const [newHashtagInput, setNewHashtagInput] = useState('');
  const [generatedCTA, setGeneratedCTA] = useState('');

  // Generation status
  const [isLoading, setIsLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Initialize from existing video metadata or prepare fresh state
  useEffect(() => {
    if (isOpen && video) {
      setErrorMessage(null);
      setIsLoading(false);
      if (video.aiMetadata) {
        setGeneratedTitle(video.aiMetadata.title || video.title);
        setGeneratedDescription(video.aiMetadata.description || '');
        setGeneratedHashtags(video.aiMetadata.hashtags || []);
        setGeneratedCTA(video.aiMetadata.callToAction || '');
        setHasGenerated(true);
      } else {
        setGeneratedTitle(video.title);
        setGeneratedDescription('');
        setGeneratedHashtags([]);
        setGeneratedCTA('');
        setHasGenerated(false);
      }
    }
  }, [isOpen, video]);

  if (!isOpen || !video) return null;

  const handleGenerate = async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/ai/generate-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.id,
          title: video.title,
          duration: video.duration,
          thumbnail: video.thumbnail,
          videoUrl: video.videoUrl,
          platforms: ['tiktok', 'instagram', 'youtube'],
          model: selectedModel,
          promptContext: promptNotes.trim(),
          tone: selectedTone,
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Erro HTTP ${response.status} na API de IA.`);
      }

      const result = await response.json();
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Não foi possível gerar as informações do vídeo.');
      }

      const { title, description, hashtags, callToAction } = result.data;
      setGeneratedTitle(title || video.title);
      setGeneratedDescription(description || '');
      setGeneratedHashtags(Array.isArray(hashtags) ? hashtags : ['#clipo', '#shorts']);
      setGeneratedCTA(callToAction || '');
      setHasGenerated(true);
    } catch (err: any) {
      console.error('Erro ao gerar com IA:', err);
      setErrorMessage(
        err.message || 'Falha ao conectar com o serviço de Inteligência Artificial. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHashtag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = newHashtagInput.trim().replace(/\s+/g, '');
    if (!clean) return;
    const formatted = clean.startsWith('#') ? clean : `#${clean}`;
    if (!generatedHashtags.includes(formatted)) {
      setGeneratedHashtags([...generatedHashtags, formatted]);
    }
    setNewHashtagInput('');
  };

  const handleRemoveHashtag = (tagToRemove: string) => {
    setGeneratedHashtags(generatedHashtags.filter((t) => t !== tagToRemove));
  };

  const handleCopyFullPost = () => {
    const fullText = `${generatedTitle}\n\n${generatedDescription}\n\n${generatedCTA}\n\n${generatedHashtags.join(' ')}`;
    navigator.clipboard.writeText(fullText);
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2500);
  };

  const currentAIMetadata: AIMetadata = {
    title: generatedTitle || video.title,
    description: generatedDescription,
    hashtags: generatedHashtags,
    callToAction: generatedCTA,
    modelUsed: selectedModel,
    generatedAt: new Date().toISOString(),
  };

  const handleSaveOnly = () => {
    onSaveToVideo(video.id, generatedTitle.trim() || video.title, currentAIMetadata);
    onClose();
  };

  const handleScheduleAction = () => {
    onScheduleWithAI(
      {
        ...video,
        title: generatedTitle.trim() || video.title,
        aiMetadata: currentAIMetadata,
      },
      currentAIMetadata
    );
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
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Gerar com IA</h2>
              <p className="text-xs text-[#FDBA74]">
                Criação automática de títulos magnéticos, descrições, hashtags e CTA
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Target Video Preview Banner */}
          <div className="flex items-center gap-3 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black border border-[#27272A]">
              <img
                src={video.thumbnail}
                alt={video.title}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white" title={video.title}>
                {video.title}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#FDBA74]">
                <span className="flex items-center gap-1 font-mono text-white">
                  <Clock className="h-3 w-3 text-[#F97316]" />
                  {video.duration}
                </span>
                <span aria-hidden="true" className="text-[#FDBA74]/50">·</span>
                <span>{video.fileSize}</span>
                <span aria-hidden="true" className="text-[#FDBA74]/50">·</span>
                <span className="text-emerald-400">Análise de conteúdo real</span>
              </div>
            </div>
          </div>

          {/* Model & Tone Selector */}
          <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-[#F97316]" />
                <span>Configurações do modelo de IA</span>
              </span>
              <button
                type="button"
                onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                className="text-[11px] text-[#F97316] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>{showAdvancedSettings ? 'Ocultar opções' : 'Ajustar tom e modelo'}</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${showAdvancedSettings ? 'rotate-180' : ''}`} />
              </button>
            </div>

            {showAdvancedSettings && (
              <div className="space-y-3 pt-2 border-t border-[#27272A]">
                {/* AI Model Selection */}
                <div>
                  <label className="block text-[11px] font-medium text-[#FDBA74] mb-1">
                    Modelo de Inteligência Artificial:
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full rounded-lg border border-[#27272A] bg-[#151515] px-2.5 py-1.5 text-xs text-white focus:border-[#F97316] focus:outline-none"
                  >
                    {AI_MODELS_OPTIONS.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} — {m.desc}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tone Selection */}
                <div>
                  <label className="block text-[11px] font-medium text-[#FDBA74] mb-1">
                    Tom de voz:
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {TONE_OPTIONS.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSelectedTone(t.id)}
                        className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium text-center transition cursor-pointer ${
                          selectedTone === t.id
                            ? 'border-[#F97316] bg-[#F97316]/15 text-white'
                            : 'border-[#27272A] bg-[#151515] text-[#FDBA74] hover:text-white'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Custom Context */}
                <div>
                  <label className="block text-[11px] font-medium text-[#FDBA74] mb-1">
                    Observação adicional para a IA (opcional):
                  </label>
                  <input
                    type="text"
                    value={promptNotes}
                    onChange={(e) => setPromptNotes(e.target.value)}
                    placeholder="Ex: Focar no público iniciante, enfatizar link na bio..."
                    className="w-full rounded-lg border border-[#27272A] bg-[#151515] px-3 py-1.5 text-xs text-white placeholder-[#71717A] focus:border-[#F97316] focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Trigger Banner (if not yet generated) */}
          {!hasGenerated && !isLoading && !errorMessage && (
            <div className="rounded-xl border border-[#F97316]/30 bg-[#F97316]/10 p-5 text-center space-y-3">
              <Sparkles className="h-8 w-8 text-[#F97316] mx-auto animate-pulse" />
              <h3 className="text-sm font-semibold text-white">
                Pronto para gerar as informações de publicação?
              </h3>
              <p className="text-xs text-[#FDBA74] max-w-md mx-auto">
                A IA analisará o título base, a duração ({video.duration}) e o conteúdo visual do vídeo para criar títulos magnéticos, descrição envolvente, hashtags e CTA de alto impacto.
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition cursor-pointer active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4" />
                <span>Gerar com IA agora</span>
              </button>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-8 text-center space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-[#F97316] mx-auto" />
              <h4 className="text-sm font-semibold text-white">
                Analisando vídeo com {selectedModel}...
              </h4>
              <p className="text-xs text-[#FDBA74] max-w-sm mx-auto">
                Estruturando título com gancho nos primeiros 3 segundos, copywriting persuasivo, hashtags estratégicas e CTA...
              </p>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="font-semibold text-rose-300">Falha ao gerar com IA</p>
                <p className="text-rose-200/90 leading-relaxed">{errorMessage}</p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600/30 px-3 py-1.5 font-semibold text-rose-100 hover:bg-rose-600/50 transition cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            </div>
          )}

          {/* Results: Editable Generated Content (Requisitos 1, 2, 3, 4) */}
          {hasGenerated && !isLoading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  <span>Informações geradas pela IA (editáveis)</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyFullPost}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#FDBA74] hover:text-white transition cursor-pointer px-2 py-1 rounded-md hover:bg-[#0A0A0A]"
                  >
                    <Copy className="h-3 w-3 text-[#F97316]" />
                    <span>{copiedSuccess ? 'Copiado!' : 'Copiar post'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="flex items-center gap-1 text-[11px] font-medium text-[#F97316] hover:text-white transition cursor-pointer px-2 py-1 rounded-md hover:bg-[#0A0A0A]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Gerar novamente</span>
                  </button>
                </div>
              </div>

              {/* 1. TÍTULO */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#F97316]" />
                    <span>1. Título do vídeo</span>
                  </span>
                  <span className="text-[11px] font-mono text-[#FDBA74]">
                    {generatedTitle.length} caracteres
                  </span>
                </label>
                <input
                  type="text"
                  value={generatedTitle}
                  onChange={(e) => setGeneratedTitle(e.target.value)}
                  placeholder="Título para o vídeo..."
                  className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white focus:border-[#F97316] focus:outline-none"
                />
              </div>

              {/* 2. DESCRIÇÃO */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-[#F97316]" />
                    <span>2. Descrição / Legenda</span>
                  </span>
                  <span className="text-[11px] font-mono text-[#FDBA74]">
                    {generatedDescription.length} caracteres
                  </span>
                </label>
                <textarea
                  rows={3}
                  value={generatedDescription}
                  onChange={(e) => setGeneratedDescription(e.target.value)}
                  placeholder="Descrição envolvente do vídeo..."
                  className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 text-xs text-white focus:border-[#F97316] focus:outline-none resize-none leading-relaxed"
                />
              </div>

              {/* 3. HASHTAGS */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-[#F97316]" />
                    <span>3. Hashtags relevantes ({generatedHashtags.length})</span>
                  </span>
                  <span className="text-[11px] text-[#FDBA74]">
                    Clique no 'x' para remover ou digite para adicionar
                  </span>
                </label>

                {/* Tags chip list */}
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] min-h-[42px] items-center">
                  {generatedHashtags.map((tag) => (
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
                      placeholder="+ hashtag..."
                      className="w-24 rounded-md border border-[#27272A] bg-[#151515] px-2 py-0.5 text-[11px] text-white focus:border-[#F97316] focus:outline-none"
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

              {/* 4. SUGESTÃO DE CHAMADA PARA O PÚBLICO (CTA) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-[#F97316]" />
                  <span>4. Sugestão de chamada para o público (CTA)</span>
                </label>
                <input
                  type="text"
                  value={generatedCTA}
                  onChange={(e) => setGeneratedCTA(e.target.value)}
                  placeholder="Chamada para ação convidando o público a interagir..."
                  className="w-full rounded-xl border border-[#27272A] bg-[#0A0A0A] px-3.5 py-2.5 text-xs text-white focus:border-[#F97316] focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-[#27272A] pt-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition cursor-pointer"
          >
            Fechar
          </button>

          {hasGenerated && (
            <>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isLoading}
                className="flex items-center gap-1.5 rounded-xl border border-[#F97316]/30 bg-[#F97316]/10 px-3.5 py-2 text-xs font-semibold text-[#F97316] hover:bg-[#F97316]/20 transition cursor-pointer"
                title="Regenerar sugestões com IA"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Regenerar</span>
              </button>

              <button
                type="button"
                onClick={handleSaveOnly}
                className="flex items-center gap-1.5 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:border-[#F97316] transition cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                <span>Salvar dados no vídeo</span>
              </button>

              <button
                type="button"
                onClick={handleScheduleAction}
                className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition cursor-pointer active:scale-[0.98]"
              >
                <Calendar className="h-4 w-4" />
                <span>Agendar com esta IA</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
