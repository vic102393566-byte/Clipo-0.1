import React, { useState, useRef, useEffect } from 'react';
import {
  Scissors,
  X,
  Clock,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Film,
  Play,
  Pause,
  HardDrive,
  RotateCcw,
  Check,
  ChevronRight
} from 'lucide-react';
import { VideoItem } from '../types';
import { formatDuration, formatFileSize, parseDurationToSeconds } from '../utils/videoUtils';
import { authService, DEFAULT_DEMO_USER } from '../services/authService';

export interface SplitOption {
  id: '30s' | '1m' | '3m' | '5m' | 'custom';
  label: string;
  seconds: number;
}

const PRESET_OPTIONS: { id: '30s' | '1m' | '3m' | '5m'; label: string; seconds: number }[] = [
  { id: '30s', label: '30 segundos', seconds: 30 },
  { id: '1m', label: '1 minuto', seconds: 60 },
  { id: '3m', label: '3 minutos', seconds: 180 },
  { id: '5m', label: '5 minutos', seconds: 300 },
];

interface SplitVideoModalProps {
  video: VideoItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSplitComplete: (newParts: VideoItem[]) => void;
}

export const SplitVideoModal: React.FC<SplitVideoModalProps> = ({
  video,
  isOpen,
  onClose,
  onSplitComplete,
}) => {
  const [selectedOption, setSelectedOption] = useState<'30s' | '1m' | '3m' | '5m' | 'custom'>('1m');
  const [customMinutes, setCustomMinutes] = useState<number>(2);
  const [customSeconds, setCustomSeconds] = useState<number>(0);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [currentPartProcessing, setCurrentPartProcessing] = useState(0);
  const [totalPartsCalculated, setTotalPartsCalculated] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [completedParts, setCompletedParts] = useState<VideoItem[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Preview state for inspecting generated segments
  const [previewPartIndex, setPreviewPartIndex] = useState<number>(0);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  // Active Job & abort controller references
  const currentJobIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const videoPlayerRef = useRef<HTMLVideoElement | null>(null);

  // Cleanup on unmount or close
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  if (!isOpen || !video) return null;

  // Compute total seconds of current video prioritizing official durationSeconds
  const videoTotalSeconds = video.durationSeconds && video.durationSeconds > 0
    ? video.durationSeconds
    : Math.max(10, parseDurationToSeconds(video.duration));

  // Determine chosen chunk duration in seconds
  let chunkSeconds = 60;
  if (selectedOption === '30s') chunkSeconds = 30;
  else if (selectedOption === '1m') chunkSeconds = 60;
  else if (selectedOption === '3m') chunkSeconds = 180;
  else if (selectedOption === '5m') chunkSeconds = 300;
  else if (selectedOption === 'custom') {
    chunkSeconds = Math.max(5, (customMinutes * 60) + customSeconds);
  }

  // Calculate number of parts (e.g. 1020s / 300s = 4 parts: 3 of 300s + 1 of 120s)
  let estimatedParts = 1;
  if (videoTotalSeconds > chunkSeconds) {
    const fullParts = Math.floor(videoTotalSeconds / chunkSeconds);
    const remainder = videoTotalSeconds - (fullParts * chunkSeconds);
    estimatedParts = remainder >= 2.0 ? fullParts + 1 : Math.max(1, fullParts);
  }

  const getPartsBreakdown = (totalSec: number, chunkSec: number): string => {
    if (totalSec <= chunkSec) {
      return 'Gera 1 vídeo (duração total)';
    }
    const full = Math.floor(totalSec / chunkSec);
    const rem = Math.round(totalSec - (full * chunkSec));
    if (rem >= 2) {
      return `Gera ${full + 1} partes (${full} de ${formatDuration(chunkSec)} + 1 de ${formatDuration(rem)})`;
    }
    return `Gera ${full} partes de ${formatDuration(chunkSec)}`;
  };

  const handleStartSplit = async () => {
    setIsProcessing(true);
    setProgressPercent(5);
    setCurrentPartProcessing(1);
    setTotalPartsCalculated(estimatedParts);
    setCompletedParts([]);
    setErrorMessage(null);
    setProcessingStatus('Inicializando motor FFmpeg no servidor...');

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    currentJobIdRef.current = jobId;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const currentUser = authService.getCurrentUser() || DEFAULT_DEMO_USER;

    // Start polling the server for exact FFmpeg progress
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const progRes = await fetch(`/api/videos/split-progress/${jobId}`);
        if (progRes.ok) {
          const progContentType = progRes.headers.get('content-type') || '';
          if (progContentType.includes('application/json')) {
            const progData = await progRes.json();
            if (progData.success && progData.found) {
              setProgressPercent(progData.progressPercent);
              setCurrentPartProcessing(progData.currentPart);
              setTotalPartsCalculated(progData.totalParts);
              if (progData.status) {
                setProcessingStatus(progData.status);
              }
            }
          }
        }
      } catch (err) {
        // Non-blocking polling failure
      }
    }, 350);

    try {
      const formData = new FormData();
      formData.append('jobId', jobId);
      formData.append('chunkSeconds', String(chunkSeconds));
      formData.append('duration', String(chunkSeconds));
      formData.append('selectedOption', selectedOption === 'custom' ? `Personalizado (${chunkSeconds}s)` : selectedOption);
      formData.append('userId', currentUser.id);
      formData.append('title', video.title);
      formData.append('sourceVideoId', video.id);
      formData.append('uploadedBy', currentUser.email || 'vicente@clipo.io');

      // If video has blob URL, attempt to read blob binary
      if (video.videoUrl && video.videoUrl.startsWith('blob:')) {
        try {
          const blobResponse = await fetch(video.videoUrl);
          const blob = await blobResponse.blob();
          formData.append('videoFile', blob, `${video.title || 'video'}.mp4`);
        } catch (fetchBlobErr) {
          console.warn('Erro ao obter blob do vídeo local:', fetchBlobErr);
          formData.append('videoUrl', video.videoUrl);
        }
      } else if (video.videoUrl) {
        formData.append('videoUrl', video.videoUrl);
      }

      console.log(`[SPLIT REQUISIÇÃO] Endpoint: POST /api/videos/split | chunkSeconds: ${chunkSeconds} | jobId: ${jobId}`);
      const response = await fetch('/api/videos/split', {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      console.log(`[SPLIT RESPOSTA] Status HTTP: ${response.status} | Content-Type: ${response.headers.get('content-type')}`);

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (!response.ok) {
        const cType = response.headers.get('content-type') || '';
        let errorMsg = `Erro HTTP ${response.status} no processamento de vídeo.`;
        if (cType.includes('application/json')) {
          const errorData = await response.json().catch(() => ({}));
          errorMsg = errorData.error || errorMsg;
        } else {
          const rawText = await response.text().catch(() => '');
          console.error('[ERRO NÃO-JSON EM /api/videos/split]:', rawText.slice(0, 300));
        }
        throw new Error(errorMsg);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.parts) && result.parts.length > 0) {
        setProgressPercent(100);
        setProcessingStatus('Cortes concluídos com sucesso!');
        setCompletedParts(result.parts);
        setPreviewPartIndex(0);
        setIsProcessing(false);
      } else {
        throw new Error(result.error || 'Nenhum segmento gerado pelo servidor.');
      }
    } catch (err: any) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }

      if (err.name === 'AbortError') {
        setProcessingStatus('Processamento cancelado pelo usuário.');
        setIsProcessing(false);
        return;
      }

      console.error('Falha no processamento real de vídeo:', err);
      setIsProcessing(false);
      setErrorMessage(err.message || 'Ocorreu um erro ao processar o vídeo com FFmpeg. Tente novamente.');
    }
  };

  const handleCancelProcessing = async () => {
    const jobId = currentJobIdRef.current;
    if (jobId) {
      try {
        await fetch(`/api/videos/cancel-split/${jobId}`, { method: 'POST' });
      } catch (cancelErr) {
        console.warn('Erro ao requisitar cancelamento no servidor:', cancelErr);
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    setIsProcessing(false);
    setProgressPercent(0);
    setProcessingStatus('Processamento cancelado.');
  };

  const handleCloseModal = () => {
    if (isProcessing) {
      if (confirm('O corte de vídeo ainda está sendo processado no servidor. Deseja cancelar?')) {
        handleCancelProcessing();
        onClose();
      }
      return;
    }

    onClose();
    setIsProcessing(false);
    setProgressPercent(0);
    setCompletedParts([]);
    setErrorMessage(null);
  };

  const handleCommitParts = () => {
    if (completedParts.length > 0) {
      onSplitComplete(completedParts);
      onClose();
    }
  };

  const currentPreviewPart = completedParts[previewPartIndex] || null;

  const togglePreviewPlay = () => {
    if (!videoPlayerRef.current) return;
    if (videoPlayerRef.current.paused) {
      videoPlayerRef.current.play();
      setIsPlayingPreview(true);
    } else {
      videoPlayerRef.current.pause();
      setIsPlayingPreview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={handleCloseModal}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
              <Scissors className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Dividir vídeo com IA</h2>
              <p className="text-xs text-[#FDBA74]">
                Corte automático real com renderização via motor FFmpeg
              </p>
            </div>
          </div>

          <button
            onClick={handleCloseModal}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition cursor-pointer"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Source Video Summary Bar */}
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
                <span className="text-emerald-400">Vídeo base selecionado</span>
              </div>
            </div>
          </div>

          {/* Feedback: Error Message */}
          {errorMessage && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-200">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div className="flex-1 leading-relaxed">
                <p className="font-semibold text-rose-300">Falha no processamento</p>
                <p className="mt-0.5 text-rose-200/90">{errorMessage}</p>
                <button
                  type="button"
                  onClick={handleStartSplit}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-rose-600/30 px-3 py-1 font-semibold text-rose-100 hover:bg-rose-600/50 transition cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Tentar novamente</span>
                </button>
              </div>
            </div>
          )}

          {/* VIEW: PROCESSING IN PROGRESS */}
          {isProcessing && (
            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 text-xs font-semibold text-white">
                  <Loader2 className="h-4 w-4 animate-spin text-[#F97316]" />
                  <span>Processando vídeo de verdade (FFmpeg)</span>
                </div>
                <span className="font-mono text-sm font-bold text-[#F97316] tabular-nums">
                  {progressPercent}%
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#151515] border border-[#27272A]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#EA580C] to-[#F97316] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-[#FDBA74]">
                <span className="font-mono text-white">{processingStatus}</span>
                <span className="font-mono tabular-nums">
                  Parte {currentPartProcessing} de {totalPartsCalculated}
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCancelProcessing}
                  className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
                >
                  Cancelar processamento
                </button>
              </div>
            </div>
          )}

          {/* VIEW: RESULTS & PREVIEW (REQUIREMENT 7: PERMITIR VISUALIZAR OS SEGMENTOS GERADOS) */}
          {!isProcessing && completedParts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong>{completedParts.length} cortes reais gerados!</strong> Cada parte é um arquivo independente pronto para publicação.
                  </span>
                </div>
              </div>

              {/* Interactive Player & Segment Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Segment List */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-white">
                    Segmentos gerados ({completedParts.length}):
                  </label>
                  <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                    {completedParts.map((part, idx) => {
                      const isSelected = previewPartIndex === idx;
                      return (
                        <div
                          key={part.id}
                          onClick={() => {
                            setPreviewPartIndex(idx);
                            setIsPlayingPreview(false);
                          }}
                          className={`flex items-center gap-3 rounded-xl border p-2.5 cursor-pointer transition ${
                            isSelected
                              ? 'border-[#F97316] bg-[#F97316]/10 shadow-sm'
                              : 'border-[#27272A] bg-[#0A0A0A] hover:border-[#F97316]/30'
                          }`}
                        >
                          <div className="relative h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-black border border-[#27272A]">
                            <img
                              src={part.thumbnail}
                              alt={part.title}
                              className="h-full w-full object-cover"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-[#F97316]/20 flex items-center justify-center">
                                <Play className="h-3.5 w-3.5 text-white fill-white" />
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-white">
                              {part.title}
                            </p>
                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#FDBA74] font-mono">
                              <span className="text-white font-medium">{part.duration}</span>
                              <span>·</span>
                              <span>{part.fileSize}</span>
                            </div>
                          </div>

                          <ChevronRight className={`h-4 w-4 shrink-0 transition ${isSelected ? 'text-[#F97316]' : 'text-[#71717A]'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Video Player Preview Box */}
                <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 flex flex-col items-center justify-center">
                  <div className="relative w-full aspect-[9/14] max-h-56 rounded-lg overflow-hidden bg-black flex items-center justify-center border border-[#27272A]">
                    {currentPreviewPart?.videoUrl ? (
                      <video
                        ref={videoPlayerRef}
                        key={currentPreviewPart.videoUrl}
                        src={currentPreviewPart.videoUrl}
                        poster={currentPreviewPart.thumbnail}
                        controls
                        playsInline
                        className="h-full w-full object-contain"
                        onPlay={() => setIsPlayingPreview(true)}
                        onPause={() => setIsPlayingPreview(false)}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-[#71717A]">
                        <Film className="h-8 w-8 text-[#FDBA74]" />
                        <span className="text-xs">Pré-visualização indisponível</span>
                      </div>
                    )}
                  </div>

                  {currentPreviewPart && (
                    <div className="mt-2 w-full text-center">
                      <p className="truncate text-xs font-semibold text-white">
                        {currentPreviewPart.title}
                      </p>
                      <p className="text-[11px] font-mono text-[#FDBA74]">
                        Duração: {currentPreviewPart.duration} · Tamanho: {currentPreviewPart.fileSize}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* VIEW: SETTINGS & CHUNK SELECTION (INITIAL STATE) */}
          {!isProcessing && completedParts.length === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-white">
                  Selecione a duração de cada corte:
                </label>
                <p className="text-[11px] text-[#FDBA74] mt-0.5">
                  O sistema dividirá o vídeo em arquivos reais de vídeo no servidor.
                </p>
              </div>

              {/* Preset Options Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {PRESET_OPTIONS.map((opt) => {
                  const isSelected = selectedOption === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setSelectedOption(opt.id)}
                      className={`flex flex-col items-start rounded-xl border p-3 text-left transition cursor-pointer ${
                        isSelected
                          ? 'border-[#F97316] bg-[#F97316]/10 shadow-sm shadow-[#F97316]/20'
                          : 'border-[#27272A] bg-[#0A0A0A] hover:border-[#F97316]/40 hover:bg-[#151515]'
                      }`}
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-bold text-white">{opt.label}</span>
                        {isSelected && <span className="h-2 w-2 rounded-full bg-[#F97316]" />}
                      </div>
                      <span className="mt-1 font-mono text-[11px] text-[#FDBA74]">
                        {getPartsBreakdown(videoTotalSeconds, opt.seconds)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Option Card */}
              <div
                onClick={() => setSelectedOption('custom')}
                className={`cursor-pointer rounded-xl border p-3.5 transition ${
                  selectedOption === 'custom'
                    ? 'border-[#F97316] bg-[#F97316]/10'
                    : 'border-[#27272A] bg-[#0A0A0A] hover:border-[#F97316]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Duração personalizada</span>
                  {selectedOption === 'custom' && (
                    <span className="h-2 w-2 rounded-full bg-[#F97316]" />
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-[#FDBA74]">
                  Defina o intervalo exato de corte para os vídeos
                </p>

                {selectedOption === 'custom' && (
                  <div className="mt-3 flex items-center gap-3 pt-2 border-t border-[#27272A]">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={120}
                        value={customMinutes}
                        onChange={(e) => setCustomMinutes(Math.max(0, parseInt(e.target.value, 10) || 0))}
                        className="w-16 rounded-lg border border-[#27272A] bg-[#151515] px-2 py-1 text-center font-mono text-xs text-white focus:border-[#F97316] focus:outline-none"
                      />
                      <span className="text-xs text-[#FDBA74]">minutos</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={59}
                        value={customSeconds}
                        onChange={(e) => setCustomSeconds(Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0)))}
                        className="w-16 rounded-lg border border-[#27272A] bg-[#151515] px-2 py-1 text-center font-mono text-xs text-white focus:border-[#F97316] focus:outline-none"
                      />
                      <span className="text-xs text-[#FDBA74]">segundos</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Split Preview Calculation Banner */}
              <div className="rounded-xl border border-[#F97316]/30 bg-[#F97316]/10 p-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Layers className="h-4 w-4 text-[#F97316] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-white">
                      Estimativa: <span className="text-[#F97316] font-mono">{estimatedParts} {estimatedParts === 1 ? 'vídeo' : 'vídeos individuais'}</span>
                    </p>
                    <p className="text-[11px] text-[#FDBA74] font-mono">
                      {video.duration} divididos em blocos de {formatDuration(chunkSeconds)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="mt-4 flex items-center justify-end gap-3 border-t border-[#27272A] pt-4 shrink-0">
          {completedParts.length > 0 ? (
            <div className="flex items-center gap-3 w-full justify-between">
              <span className="text-xs text-[#FDBA74] flex items-center gap-1">
                <HardDrive className="h-3.5 w-3.5 text-[#F97316]" />
                {completedParts.length} arquivos salvos no storage
              </span>

              <button
                type="button"
                onClick={handleCommitParts}
                className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition cursor-pointer active:scale-[0.98]"
              >
                <Check className="h-4 w-4" />
                <span>Salvar vídeos na galeria</span>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={isProcessing}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition disabled:opacity-50 cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleStartSplit}
                disabled={isProcessing}
                className="flex items-center gap-2 rounded-xl bg-[#F97316] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Processando com FFmpeg...</span>
                  </>
                ) : (
                  <>
                    <Scissors className="h-4 w-4" />
                    <span>Iniciar corte automático</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
