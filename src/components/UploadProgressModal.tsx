import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  CheckCircle2,
  Film,
  AlertTriangle,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  HardDrive,
  FileVideo,
  Loader2,
  Scissors,
  Calendar,
  Sparkles,
  FileText,
  Hash,
  Share2,
  Copy,
  Check,
  UploadCloud
} from 'lucide-react';
import { formatFileSize, extractVideoMetadata, parseDurationToSeconds } from '../utils/videoUtils';
import { VideoItem, PlanTier } from '../types';
import { currentStorageProvider, getStoredPlan, PLANS_CONFIG } from '../services/storageService';
import { authService, DEFAULT_DEMO_USER } from '../services/authService';
import {
  supabase,
  isUUID,
  isSupabaseConfigured,
  ensureSupabaseConfigured,
  isProductionEnvironment,
  uploadVideoToSupabaseStorage,
  getEffectiveSupabaseUserId,
  categorizeUploadError,
} from '../services/supabaseClient';
import { useI18n } from '../i18n/I18nContext';

interface UploadProgressModalProps {
  file: File | null;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (newVideo: VideoItem) => void;
  onOpenSplit?: (video: VideoItem) => void;
  onScheduleVideo?: (video: VideoItem) => void;
  onNavigateVideos?: () => void;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
  file,
  isOpen,
  onClose,
  onUploadComplete,
  onOpenSplit,
  onScheduleVideo,
  onNavigateVideos,
}) => {
  const { t, language } = useI18n();
  const isEn = language === 'en-US';

  const [internalFile, setInternalFile] = useState<File | null>(file);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'error'>(
    file ? 'uploading' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [createdVideo, setCreatedVideo] = useState<VideoItem | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Post-upload feature states (Requirement 5)
  const [autoCaptions, setAutoCaptions] = useState(true);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [generatedHashtags, setGeneratedHashtags] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const uploadFileToServer = async (fileToUpload: File) => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setProgress(5);
    setStatus('uploading');
    setErrorMessage('');
    setCreatedVideo(null);

    const cleanTitle = fileToUpload.name.replace(/\.[^/.]+$/, '');
    const activeUser = authService.getCurrentUser() || DEFAULT_DEMO_USER;
    const userPlanTier: PlanTier = getStoredPlan(activeUser.id) || (activeUser.planId as PlanTier) || 'pro';
    const plan = PLANS_CONFIG[userPlanTier] || PLANS_CONFIG.pro;
    const videoId = `vid-${Date.now()}`;

    // -------------------------------------------------------------------------
    // 1. VERIFICAÇÃO LOCAL DE LIMITES DO PLANO ATIVO (Requisito 9 e 11)
    // -------------------------------------------------------------------------
    if (fileToUpload.size > plan.maxFileSizeBytes) {
      setStatus('error');
      const fileFormatted = formatFileSize(fileToUpload.size);
      const upgradeMsg = userPlanTier === 'basico' ? 'Pro (até 10 GB)' : 'Premium (até 25 GB)';
      const msg = isEn
        ? `File size (${fileFormatted}) exceeds the ${plan.name} plan limit (${plan.labelMaxFileSize}). Upgrade to ${upgradeMsg} to upload larger videos.`
        : `Arquivo muito grande para o plano ativo (${plan.name} permite até ${plan.labelMaxFileSize}). O arquivo enviado possui ${fileFormatted}. Faça upgrade para o plano ${upgradeMsg} para enviar arquivos maiores.`;
      setErrorMessage(msg);
      return;
    }

    // -------------------------------------------------------------------------
    // 2. DETECÇÃO DE AMBIENTE E SUPABASE STORAGE (Requisitos 3, 4 e 5)
    // -------------------------------------------------------------------------
    const inProduction = isProductionEnvironment();
    let supabaseReady = isSupabaseConfigured();

    // Se ainda não estiver pronto pelo build estático, tenta carregar do endpoint de runtime (/api/config)
    if (!supabaseReady) {
      supabaseReady = await ensureSupabaseConfigured();
    }

    // Se estiver em produção e o Supabase não estiver configurado, NÃO faz fallback silencioso!
    if (inProduction && !supabaseReady) {
      setStatus('error');
      const msg = isEn
        ? 'Supabase Storage is not configured in this environment. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
        : 'Supabase Storage não está configurado neste ambiente. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.';
      setErrorMessage(msg);
      console.error('[PRODUÇÃO]: Supabase Storage não configurado. Fallback para /api/videos/upload bloqueado em produção.');
      return;
    }

    // -------------------------------------------------------------------------
    // 3. FLUXO OFICIAL: SUPABASE STORAGE (TUS para > 6 MB, SDK para <= 6 MB)
    // -------------------------------------------------------------------------
    if (supabaseReady) {
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        console.log(`[SUPABASE STORAGE] Iniciando upload direto para o bucket 'clipo-videos'...`);

        // Requisito: Verificar a sessão real do Supabase antes do upload
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session;
        const supabaseUserId = (session?.user?.id && isUUID(session.user.id))
          ? session.user.id
          : await getEffectiveSupabaseUserId();

        if (!supabaseUserId) {
          throw new Error(
            isEn
              ? 'Active Supabase session not found. Please log in to upload videos to secure storage.'
              : 'Sessão de autenticação do Supabase não encontrada. Faça login para enviar vídeos ao armazenamento seguro (RLS).'
          );
        }

        console.log(`[SUPABASE STORAGE] Usuário autenticado com UUID: ${supabaseUserId}`);

        // Extração de metadados no navegador
        const meta = await extractVideoMetadata(fileToUpload);

        // Upload direto via Supabase Storage (com TUS para arquivos > 6 MB)
        const result = await uploadVideoToSupabaseStorage(fileToUpload, fileToUpload.name, {
          userId: supabaseUserId,
          signal: abortController.signal,
          onProgress: (percent) => {
            setProgress(percent);
            if (percent >= 90 && percent < 100) {
              setStatus('processing');
            }
          },
        });

        setProgress(100);
        setStatus('completed');

        const newVideo: VideoItem = {
          id: videoId,
          userId: supabaseUserId,
          title: cleanTitle || 'Vídeo sem título',
          thumbnail: meta.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
          videoUrl: result.signedUrl,
          storagePath: result.storagePath,
          duration: meta.duration || '1:00',
          durationSeconds: parseDurationToSeconds(meta.duration),
          uploadedAt: 'Hoje, agora há pouco',
          createdAt: new Date().toISOString(),
          viewsTotal: 0,
          publishedCount: 0,
          status: 'disponivel',
          fileSize: formatFileSize(fileToUpload.size),
          sizeBytes: fileToUpload.size,
          uploadedBy: activeUser.email || 'vicente@clipo.io',
          storageProvider: 'Supabase Storage (clipo-videos)',
          description: '',
          hashtags: [],
        };

        setCreatedVideo(newVideo);
        onUploadComplete(newVideo);

        setGeneratedTitle(`Corte: ${cleanTitle}`);
        setGeneratedDescription(`Vídeo gravado e otimizado com áudio e vídeo de alta qualidade.`);
        setGeneratedHashtags('#clipo #shorts #reels #viral');
        console.log(`[SUPABASE UPLOAD CONCLUÍDO] Vídeo finalizado com sucesso no Supabase Storage: ${result.storagePath}`);
      } catch (err: any) {
        if (abortController.signal.aborted) {
          console.warn('[UPLOAD CANCELADO]: Processamento interrompido pelo usuário.');
          return;
        }
        console.error('[ERRO SUPABASE STORAGE]:', err);
        setStatus('error');
        setErrorMessage(categorizeUploadError(err, { fileSizeBytes: fileToUpload.size, planTier: userPlanTier, isEn }));
      } finally {
        abortControllerRef.current = null;
      }
      return;
    }

    // -------------------------------------------------------------------------
    // 4. MODO DESENVOLVIMENTO LOCAL (Somente localhost quando Supabase não configurado)
    // -------------------------------------------------------------------------
    console.warn('[DEV LOCAL]: Supabase não configurado. Utilizando endpoint local /api/videos/upload para testes locais.');

    const formData = new FormData();
    formData.append('videoFile', fileToUpload);
    formData.append('userId', activeUser.id);
    formData.append('title', cleanTitle);
    formData.append('planTier', userPlanTier);
    formData.append('uploadedBy', activeUser.email || 'vicente@clipo.io');

    console.log(`[UPLOAD INICIADO LOCAL] Arquivo: ${fileToUpload.name} | Tamanho: ${fileToUpload.size} bytes`);

    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.timeout = 30 * 60 * 1000;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        const percent = Math.min(85, Math.max(5, Math.round((event.loaded / event.total) * 85)));
        setProgress(percent);
      }
    };

    xhr.upload.onload = () => {
      setProgress(90);
      setStatus('processing');
      console.log('[UPLOAD RECEBIDO] Dados enviados com sucesso. Processando e validando...');
    };

    xhr.onload = () => {
      xhrRef.current = null;
      const cType = xhr.getResponseHeader('content-type') || '';
      let data: any = null;

      try {
        if (cType.includes('application/json')) {
          data = JSON.parse(xhr.responseText);
        }
      } catch {
        data = null;
      }

      if (xhr.status >= 200 && xhr.status < 300 && data && data.success && data.video) {
        const serverVideo = data.video;
        setProgress(100);
        setStatus('completed');

        const newVideo: VideoItem = {
          id: serverVideo.id || videoId,
          userId: activeUser.id,
          title: cleanTitle || 'Vídeo sem título',
          thumbnail: serverVideo.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=80',
          videoUrl: serverVideo.videoUrl,
          duration: serverVideo.duration,
          durationSeconds: serverVideo.durationSeconds,
          uploadedAt: 'Hoje, agora há pouco',
          createdAt: new Date().toISOString(),
          viewsTotal: 0,
          publishedCount: 0,
          status: 'disponivel',
          fileSize: serverVideo.fileSize || formatFileSize(fileToUpload.size),
          sizeBytes: serverVideo.sizeBytes || fileToUpload.size,
          uploadedBy: activeUser.email || 'vicente@clipo.io',
          storageProvider: 'Clipo Video Engine (Local)',
          description: '',
          hashtags: [],
        };

        setCreatedVideo(newVideo);
        onUploadComplete(newVideo);

        setGeneratedTitle(`Corte: ${cleanTitle}`);
        setGeneratedDescription(`Vídeo gravado e otimizado com áudio e vídeo de alta qualidade.`);
        setGeneratedHashtags('#clipo #shorts #reels #viral');
        console.log(`[UPLOAD CONCLUÍDO LOCAL] Vídeo finalizado com sucesso: ${newVideo.id}`);
      } else {
        const errorMsg = data?.error || categorizeUploadError({ status: xhr.status, message: data?.error }, { fileSizeBytes: fileToUpload.size, planTier: userPlanTier, isEn });
        console.error('[ERRO NO UPLOAD LOCAL]:', errorMsg);
        setStatus('error');
        setErrorMessage(errorMsg || (isEn ? 'Upload failed — Please try again' : 'Falha no upload — Tentar novamente'));
      }
    };

    xhr.onerror = () => {
      xhrRef.current = null;
      console.error('[ERRO NO UPLOAD]: Falha de conexão durante o upload.');
      setStatus('error');
      setErrorMessage(categorizeUploadError(new Error('Network connection failed'), { isEn }));
    };

    xhr.ontimeout = () => {
      xhrRef.current = null;
      console.error('[ERRO NO UPLOAD]: Tempo limite de upload esgotado.');
      setStatus('error');
      setErrorMessage(isEn ? 'Network timeout during video upload — Please try again' : 'Tempo limite de rede esgotado durante o envio — Tentar novamente');
    };

    xhr.onabort = () => {
      xhrRef.current = null;
      console.warn('[UPLOAD CANCELADO]: Processamento interrompido.');
    };

    xhr.open('POST', '/api/videos/upload', true);
    xhr.send(formData);
  };

  const handleRetryUpload = () => {
    if (internalFile) {
      uploadFileToServer(internalFile);
    }
  };

  // Sync prop file with internalFile
  useEffect(() => {
    if (file) {
      setInternalFile(file);
    }
  }, [file]);

  // Main upload runner effect
  useEffect(() => {
    if (!isOpen) {
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setProgress(0);
      setStatus('idle');
      setInternalFile(null);
      setCreatedVideo(null);
      setErrorMessage('');
      setGeneratedTitle('');
      setGeneratedDescription('');
      setGeneratedHashtags('');
      return;
    }

    if (internalFile) {
      uploadFileToServer(internalFile);
    } else {
      setStatus('idle');
    }

    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
        xhrRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [isOpen, internalFile]);

  if (!isOpen) return null;

  // Handle local drop or selection
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setInternalFile(droppedFile);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFile = e.target.files?.[0];
    if (pickedFile) {
      setInternalFile(pickedFile);
    }
  };

  // Helper to load a real valid sample video file for instant test
  const handleUseDemoVideo = async () => {
    try {
      const res = await fetch('/media/samples/sample-long.mp4');
      const blob = await res.blob();
      const demoFile = new File([blob], 'video_podcast_clipo_10min.mp4', { type: 'video/mp4' });
      setInternalFile(demoFile);
    } catch {
      try {
        const res2 = await fetch('/media/samples/vid-1.mp4');
        const blob2 = await res2.blob();
        const demoFile2 = new File([blob2], 'corte_podcast_clipo_9x16.mp4', { type: 'video/mp4' });
        setInternalFile(demoFile2);
      } catch (err) {
        console.warn('Erro ao carregar vídeo de exemplo:', err);
      }
    }
  };

  const uploadedBytes = internalFile ? Math.floor((internalFile.size * progress) / 100) : 0;

  const handleCopyMetadata = () => {
    const textToCopy = `${generatedTitle}\n\n${generatedDescription}\n\n${generatedHashtags}`;
    navigator.clipboard?.writeText(textToCopy);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleFinishAndNavigate = () => {
    onClose();
    if (onNavigateVideos) {
      onNavigateVideos();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (status === 'completed') onClose();
        }}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-xl rounded-2xl border border-[#27272A] bg-[#151515] p-5 sm:p-6 shadow-2xl z-10 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272A] pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F97316]/20 text-[#F97316] border border-[#F97316]/30">
              <FileVideo className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {status === 'completed'
                  ? (isEn ? 'Video Ready · Next Steps' : 'Vídeo pronto · Próximas etapas')
                  : status === 'error'
                  ? (isEn ? 'Upload Failed' : 'Falha no upload do vídeo')
                  : status === 'processing'
                  ? (isEn ? 'Processing Video · Optimization & AI' : 'Processando vídeo · Otimização e IA')
                  : status === 'uploading'
                  ? (isEn ? 'Uploading Video to Clipo' : 'Enviando vídeo para o Clipo')
                  : (isEn ? 'Video Upload · Clipo' : 'Upload de vídeo · Clipo')}
              </h2>
              <p className="text-xs text-[#FDBA74]">
                {status === 'completed'
                  ? (isEn ? 'Choose workflow tools to prepare and schedule your content' : 'Escolha as ferramentas para preparar e agendar seu conteúdo')
                  : status === 'error'
                  ? (isEn ? 'An error occurred during file processing. Please try again.' : 'Ocorreu um erro no processamento do arquivo. Tente novamente.')
                  : status === 'processing'
                  ? (isEn ? 'Extracting metadata and validating stream with FFprobe' : 'Extraindo metadados e validando com FFprobe')
                  : status === 'uploading'
                  ? (isEn ? 'Please wait while file is uploaded and optimized' : 'Aguarde o processamento e a otimização do arquivo')
                  : (isEn ? 'Select or drag your video file to start automated processing' : 'Selecione ou arraste seu vídeo para iniciar o fluxo inteligente')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#FDBA74] hover:bg-[#0A0A0A] hover:text-white transition"
            aria-label={t.common.close}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dropzone when idle (no file selected yet) */}
        {status === 'idle' && (
          <div className="mt-4 space-y-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-7 text-center transition-all ${
                isDragging
                  ? 'border-[#F97316] bg-[#F97316]/10'
                  : 'border-[#27272A] bg-[#0A0A0A] hover:border-[#F97316]/50'
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#F97316]/15 text-[#F97316] mb-3">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-white">
                {isEn ? 'Drag your video file here' : 'Arraste seu arquivo de vídeo aqui'}
              </h3>
              <p className="mt-1 text-xs text-[#FDBA74]">
                {isEn ? 'Supported formats: MP4, MOV or WebM · Pro: long videos up to 2 hours (podcasts, lives and classes)' : 'Formatos aceitos: MP4, MOV ou WebM · Plano Pro: vídeos longos de até 2 horas (podcasts, lives e aulas)'}
              </p>

              <label className="mt-4 inline-flex items-center gap-2 cursor-pointer rounded-xl bg-[#F97316] px-4 py-2 text-xs font-semibold text-white shadow-md shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98]">
                <FileVideo className="h-4 w-4" />
                <span>{isEn ? 'Select from device' : 'Selecionar do dispositivo'}</span>
                <input
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={handleFileInputChange}
                />
              </label>
            </div>

            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/15 text-[#F97316]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white">{isEn ? 'No video right now?' : 'Sem vídeo no momento?'}</p>
                  <p className="text-[11px] text-[#FDBA74] truncate">
                    {isEn ? 'Test the full workflow with a 9:16 demo sample' : 'Teste o fluxo completo com um vídeo demonstrativo 9:16'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleUseDemoVideo}
                className="shrink-0 rounded-lg border border-[#F97316]/40 bg-[#F97316]/10 px-3 py-1.5 text-xs font-semibold text-[#F97316] hover:bg-[#F97316]/20 transition whitespace-nowrap cursor-pointer"
              >
                {isEn ? 'Use demo video' : 'Usar vídeo demo'}
              </button>
            </div>
          </div>
        )}

        {/* File Progress Box when uploading, processing or completed */}
        {status !== 'idle' && internalFile && (
          <div className="mt-4 rounded-xl border border-[#27272A] bg-[#0A0A0A] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/15 text-[#F97316] border border-[#F97316]/30">
                  <Film className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-white" title={internalFile.name}>
                    {internalFile.name}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#FDBA74]">
                    <span className="font-mono tabular-nums text-white">
                      {formatFileSize(internalFile.size)}
                    </span>
                    <span aria-hidden="true" className="text-[#FDBA74]/50">·</span>
                    <span className="uppercase">{internalFile.name.split('.').pop() || 'VÍDEO'}</span>
                  </div>
                </div>
              </div>

              {/* Status indicator badge */}
              <div className="shrink-0 text-right">
                {status === 'completed' ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    {isEn ? 'Ready' : 'Pronto'}
                  </span>
                ) : status === 'error' ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-rose-400">
                    <AlertCircle className="h-4 w-4" />
                    {isEn ? 'Failed' : 'Falha'}
                  </span>
                ) : status === 'processing' ? (
                  <span className="flex items-center gap-1 text-xs font-medium text-amber-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {isEn ? 'Processing' : 'Processando'}
                  </span>
                ) : (
                  <span className="font-mono text-xs font-bold text-[#F97316] tabular-nums">
                    {progress}%
                  </span>
                )}
              </div>
            </div>

            {/* Progress Bar Container */}
            <div className="mt-3 space-y-1.5">
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#151515] border border-[#27272A]">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    status === 'completed'
                      ? 'bg-emerald-500'
                      : status === 'error'
                      ? 'bg-rose-500'
                      : 'bg-[#F97316]'
                  }`}
                  style={{ width: `${status === 'error' ? 100 : progress}%` }}
                />
              </div>

              {/* Transferred size indicator & status note */}
              <div className="flex items-center justify-between text-[11px] text-[#FDBA74] font-mono tabular-nums">
                <span>
                  {formatFileSize(uploadedBytes)} {isEn ? 'of' : 'de'} {formatFileSize(internalFile.size)}
                </span>
                <span>
                  {status === 'uploading' && (isEn ? 'Uploading media data...' : 'Transferindo dados...')}
                  {status === 'processing' && (isEn ? 'Analyzing stream with FFprobe...' : 'Validando vídeo com FFprobe...')}
                  {status === 'completed' && (isEn ? '100% complete' : '100% concluído')}
                  {status === 'error' && (isEn ? 'File upload failed' : 'Falha no upload do arquivo')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Error Card when status === 'error' */}
        {status === 'error' && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-rose-300">{isEn ? 'Upload Failed' : 'Falha no upload'}</h4>
                <p className="mt-1 text-xs text-rose-200/90 leading-relaxed">
                  {errorMessage || (isEn ? 'An error occurred during video upload and processing.' : 'Ocorreu um erro ao enviar e processar o vídeo.')}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-rose-500/20">
              <button
                type="button"
                onClick={handleRetryUpload}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-rose-500 transition active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isEn ? 'Upload failed — Try again' : 'Falha no upload — Tentar novamente'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInternalFile(null);
                  setStatus('idle');
                  setErrorMessage('');
                  setProgress(0);
                }}
                className="rounded-lg border border-[#27272A] bg-[#0A0A0A] px-3 py-1.5 text-xs text-[#FDBA74] hover:text-white transition cursor-pointer"
              >
                {isEn ? 'Choose another file' : 'Escolher outro arquivo'}
              </button>
            </div>
          </div>
        )}

        {/* 5. FUNÇÕES APRESENTADAS APÓS O UPLOAD */}
        {status === 'completed' && createdVideo && (
          <div className="mt-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Feature 1: Corte Automático 9:16 */}
            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[#F97316]/50 transition">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316]/15 text-[#F97316]">
                  <Scissors className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    {isEn ? '9:16 Vertical Trim & Split' : 'Corte automático 9:16'}
                  </h3>
                </div>
              </div>

              {onOpenSplit && (
                <button
                  type="button"
                  onClick={() => {
                    const vid = createdVideo;
                    onClose();
                    onOpenSplit(vid);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#F97316]/40 bg-[#F97316]/10 px-3 py-1.5 text-xs font-semibold text-[#F97316] hover:bg-[#F97316]/20 transition active:scale-[0.98] whitespace-nowrap cursor-pointer"
                >
                  <Scissors className="h-3.5 w-3.5" />
                  <span>{isEn ? 'Split into clips' : 'Dividir em cortes'}</span>
                </button>
              )}
            </div>

            {/* Feature 2: Legendas Automáticas Dinâmicas */}
            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 flex items-center justify-between gap-3 hover:border-[#F97316]/50 transition">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    {isEn ? 'Dynamic Auto Captions' : 'Legendas automáticas'}
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAutoCaptions(!autoCaptions)}
                className={`h-5 w-9 shrink-0 rounded-full p-0.5 transition cursor-pointer ${
                  autoCaptions ? 'bg-[#F97316]' : 'bg-[#27272A]'
                }`}
                title={isEn ? 'Toggle captions' : 'Ativar/desativar legendas'}
              >
                <div
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    autoCaptions ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Features 3, 4 & 5: Geração de Título, Descrição e Hashtags com IA */}
            <div className="rounded-xl border border-[#27272A] bg-[#0A0A0A] p-3 space-y-2.5 hover:border-[#F97316]/50 transition">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-white">
                      {isEn ? 'AI Title, Description & Hashtags' : 'Título, descrição & hashtags com IA'}
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyMetadata}
                  className="flex items-center gap-1 rounded-md border border-[#27272A] bg-[#151515] px-2 py-1 text-[11px] font-medium text-[#FDBA74] hover:text-white transition cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">{t.common.copied}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>{isEn ? 'Copy smart copy' : 'Copiar sugestão'}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="rounded-lg bg-[#151515] p-2.5 text-[11px] space-y-1.5 border border-[#27272A]">
                <div>
                  <span className="text-[#FDBA74]/70 font-semibold uppercase text-[9px] block">
                    {isEn ? 'Suggested Title:' : 'Sugestão de título:'}
                  </span>
                  <p className="font-semibold text-white">{generatedTitle}</p>
                </div>
                <div>
                  <span className="text-[#FDBA74]/70 font-semibold uppercase text-[9px] block">
                    {isEn ? 'Description & Hook:' : 'Descrição & chamada:'}
                  </span>
                  <p className="text-[#FDBA74]">{generatedDescription}</p>
                </div>
                <div>
                  <span className="text-[#FDBA74]/70 font-semibold uppercase text-[9px] block">
                    {isEn ? 'Trending Viral Hashtags:' : 'Hashtags virais recomendadas:'}
                  </span>
                  <p className="font-mono text-[#F97316] font-medium">{generatedHashtags}</p>
                </div>
              </div>
            </div>

            {/* Features 6 & 7: Preparação para Publicação e Agendamento */}
            <div className="rounded-xl border border-[#F97316]/50 bg-gradient-to-r from-[#F97316]/10 to-[#151515] p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F97316] text-white shadow-sm">
                  <Calendar className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">
                    {isEn ? 'Channel Publishing & Schedule' : 'Preparação & agendamento nos canais'}
                  </h3>
                  <p className="text-[11px] text-[#FDBA74]">
                    {isEn ? 'Distribute to TikTok, Instagram Reels and YouTube Shorts' : 'Distribuir no TikTok, Instagram Reels e YouTube Shorts'}
                  </p>
                </div>
              </div>

              {onScheduleVideo && (
                <button
                  type="button"
                  onClick={() => {
                    const vid = createdVideo;
                    onClose();
                    onScheduleVideo(vid);
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#F97316] px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] whitespace-nowrap cursor-pointer"
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>{isEn ? 'Schedule now' : 'Agendar agora'}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2.5 border-t border-[#27272A] pt-4">
          {status === 'error' ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition cursor-pointer"
              >
                {t.common.close}
              </button>
              <button
                type="button"
                onClick={handleRetryUpload}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#F97316] px-4 py-2 text-xs font-bold text-white shadow-md shadow-[#F97316]/30 hover:bg-[#EA580C] transition active:scale-[0.98] cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isEn ? 'Upload failed — Try again' : 'Falha no upload — Tentar novamente'}</span>
              </button>
            </>
          ) : status !== 'completed' ? (
            <button
              type="button"
              onClick={() => {
                if (xhrRef.current) {
                  xhrRef.current.abort();
                  xhrRef.current = null;
                }
                onClose();
              }}
              className="rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-medium text-[#FDBA74] hover:text-white transition cursor-pointer"
            >
              {isEn ? 'Cancel upload' : 'Cancelar upload'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinishAndNavigate}
              className="flex items-center gap-2 rounded-xl border border-[#27272A] bg-[#0A0A0A] px-4 py-2 text-xs font-semibold text-white hover:border-[#F97316] hover:bg-[#151515] transition active:scale-[0.98] cursor-pointer"
            >
              <span>{isEn ? 'Finish and View in My Videos' : 'Concluir e ver em Meus Vídeos'}</span>
              <ArrowRight className="h-4 w-4 text-[#F97316]" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
