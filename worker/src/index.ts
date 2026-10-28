import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { exec } from 'node:child_process';
import {
  ActiveSplitJob,
  SplitRequestPayload,
  VideoPartItem,
  AuthenticatedUser,
  ActiveSubtitleJob,
  SubtitlesRequestPayload,
  SubtitleFilesResult,
} from './types.js';
import {
  formatDurationHelper,
  formatFileSizeHelper,
  probeVideoDetails,
  cutVideoSegment,
  extractThumbnail,
  killProcessTree,
} from './ffmpeg.js';
import {
  authenticateSupabaseUser,
  downloadVideoFromStorage,
  uploadFileToStorage,
  createSignedUrlForPath,
  cleanupJobCutsFromStorage,
  cleanupJobSubtitlesFromStorage,
} from './supabase.js';
import {
  checkSpeechConfigStatus,
  transcribeVideoToSubtitles,
} from './speech.js';

const app = express();
const PORT = process.env.PORT || 8080;
const TEMP_ROOT = process.env.TEMP_DIR || '/tmp/clipo-jobs';

// Limites operacionais de segurança
const MAX_CONCURRENT_JOBS = 3;
const MAX_JOBS_PER_USER = 1;
const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024; // 500 MB
const MAX_VIDEO_DURATION_SEC = 10800; // 3 horas
const MAX_PARTS_ALLOWED = 30; // Máximo de partes por corte
const JOB_RETENTION_MS = 5 * 60 * 1000; // 5 minutos de retenção pós-conclusão/cancelamento

// Garantir existência do diretório temporário
if (!fs.existsSync(TEMP_ROOT)) {
  fs.mkdirSync(TEMP_ROOT, { recursive: true });
}

// -----------------------------------------------------------------------------
// Configuração de CORS Restritivo Nativo (NUNCA usa '*' como padrão)
// -----------------------------------------------------------------------------
const defaultAllowedOrigins = [
  'https://clipo-0-1.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

const envOrigins = (process.env.ALLOWED_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter((o) => o.length > 0 && o !== '*');

const allowedOriginsSet = new Set([...defaultAllowedOrigins, ...envOrigins]);

app.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  if (origin) {
    if (allowedOriginsSet.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Vary', 'Origin');
    } else if (req.method === 'OPTIONS') {
      return res.status(403).json({
        success: false,
        error: `Origem não autorizada pelas políticas de segurança CORS: ${origin}`,
      });
    }
  }

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Armazenamento em memória de trabalhos ativos no container
const activeJobs = new Map<string, ActiveSplitJob>();
const activeSubtitleJobs = new Map<string, ActiveSubtitleJob>();

// -----------------------------------------------------------------------------
// Middleware de Autenticação Obrigatória Supabase Auth
// -----------------------------------------------------------------------------
async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Autenticação obrigatória. Forneça o token de acesso do Supabase no cabeçalho Authorization: Bearer <token>.',
    });
  }

  const user = await authenticateSupabaseUser(authHeader);
  if (!user || !user.id) {
    return res.status(401).json({
      success: false,
      error: 'Sessão do Supabase inválida ou expirada. Faça login novamente no Clipo.',
    });
  }

  (req as Request & { user: AuthenticatedUser }).user = user;
  next();
}

// -----------------------------------------------------------------------------
// Endpoints Públicos de Diagnóstico / Health Check
// -----------------------------------------------------------------------------
app.get('/health', (_req: Request, res: Response) => {
  const speechStatus = checkSpeechConfigStatus();
  return res.json({
    status: 'ok',
    service: 'clipo-video-worker',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeSplitJobsCount: activeJobs.size,
    activeSubtitleJobsCount: activeSubtitleJobs.size,
    speechConfigured: speechStatus.isConfigured,
    speechDetails: speechStatus.details,
  });
});

app.get('/api/videos/ffmpeg-status', async (_req: Request, res: Response) => {
  const runCmd = (cmd: string): Promise<{ success: boolean; output: string }> => {
    return new Promise((resolve) => {
      exec(cmd, (err, stdout, stderr) => {
        if (err) {
          resolve({ success: false, output: (stderr || err.message).trim() });
        } else {
          resolve({ success: true, output: (stdout || stderr).trim() });
        }
      });
    });
  };

  const [whichFfmpeg, whichFfprobe, verFfmpeg, verFfprobe] = await Promise.all([
    runCmd('which ffmpeg'),
    runCmd('which ffprobe'),
    runCmd('ffmpeg -version'),
    runCmd('ffprobe -version'),
  ]);

  return res.json({
    success: true,
    ffmpegAvailable: whichFfmpeg.success,
    ffprobeAvailable: whichFfprobe.success,
    ffmpegPath: whichFfmpeg.output,
    ffprobePath: whichFfprobe.output,
    ffmpegVersion: verFfmpeg.output.split('\n')[0] || '',
    ffprobeVersion: verFfprobe.output.split('\n')[0] || '',
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
    },
  });
});

app.get('/api/videos/speech-status', (_req: Request, res: Response) => {
  const status = checkSpeechConfigStatus();
  return res.json({
    success: true,
    isConfigured: status.isConfigured,
    details: status.details,
  });
});

// -----------------------------------------------------------------------------
// Endpoint Protegido: Consulta de Progresso de Corte (Polling)
// -----------------------------------------------------------------------------
app.get('/api/videos/split-progress/:jobId', requireAuth, (req: Request, res: Response) => {
  const authUser = (req as Request & { user: AuthenticatedUser }).user;
  const { jobId } = req.params;

  if (!jobId || !/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
    return res.status(400).json({
      success: false,
      error: 'Identificador de trabalho (jobId) inválido.',
    });
  }

  const job = activeJobs.get(jobId);

  if (!job) {
    return res.json({
      success: true,
      found: false,
      progressPercent: 100,
      status: 'Trabalho concluído ou não encontrado nesta instância',
      cancelled: false,
    });
  }

  if (job.userId !== authUser.id) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: este processamento pertence a outro usuário.',
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
    error: job.error,
  });
});

// -----------------------------------------------------------------------------
// Endpoint Protegido: Cancelamento de Corte
// -----------------------------------------------------------------------------
app.post('/api/videos/cancel-split/:jobId', requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as Request & { user: AuthenticatedUser }).user;
  const { jobId } = req.params;

  if (!jobId || !/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
    return res.status(400).json({
      success: false,
      error: 'Identificador de trabalho (jobId) inválido.',
    });
  }

  const job = activeJobs.get(jobId);

  if (!job) {
    return res.json({
      success: true,
      message: 'Trabalho não encontrado ou já finalizado nesta instância.',
    });
  }

  if (job.userId !== authUser.id) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: você não tem permissão para cancelar este processamento.',
    });
  }

  job.cancelled = true;
  job.status = 'Processamento cancelado pelo usuário';
  job.finishedAt = Date.now();
  job.updatedAt = Date.now();

  if (job.process) {
    killProcessTree(job.process);
  }

  try {
    if (fs.existsSync(job.jobDir)) {
      fs.rmSync(job.jobDir, { recursive: true, force: true });
    }
  } catch (cleanErr: any) {
    console.warn(`[Worker Cleanup] Erro ao limpar diretório temporário do job ${jobId}:`, cleanErr.message);
  }

  await cleanupJobCutsFromStorage(job.userId, jobId);

  setTimeout(() => {
    activeJobs.delete(jobId);
  }, JOB_RETENTION_MS);

  return res.json({
    success: true,
    message: 'Processamento cancelado e recursos limpos com sucesso.',
  });
});

// -----------------------------------------------------------------------------
// Endpoint Protegido Principal: Início do Corte de Vídeo com FFmpeg
// -----------------------------------------------------------------------------
app.post('/api/videos/split', requireAuth, async (req: Request, res: Response) => {
  const authUser = (req as Request & { user: AuthenticatedUser }).user;
  const payload: SplitRequestPayload = req.body;

  const userId = authUser.id;
  if (payload.userId && payload.userId !== userId) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: o userId informado na requisição não corresponde ao usuário autenticado.',
    });
  }

  let runningTotal = 0;
  let runningForUser = 0;
  for (const item of activeJobs.values()) {
    if (!item.cancelled && !item.finishedAt) {
      runningTotal++;
      if (item.userId === userId) {
        runningForUser++;
      }
    }
  }

  if (runningForUser >= MAX_JOBS_PER_USER) {
    return res.status(409).json({
      success: false,
      error: 'Já existe um corte em andamento para a sua conta. Aguarde a conclusão ou cancele o trabalho anterior.',
    });
  }

  if (runningTotal >= MAX_CONCURRENT_JOBS) {
    return res.status(503).json({
      success: false,
      error: 'O servidor de processamento está com a capacidade máxima ocupada no momento. Tente novamente em alguns minutos.',
    });
  }

  let jobId = payload.jobId;
  if (!jobId || !/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
    jobId = `job_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  const rawChunk = payload.chunkSeconds ?? payload.duration;
  const chunkSeconds = typeof rawChunk === 'number' ? rawChunk : parseInt(String(rawChunk || ''), 10);
  if (!chunkSeconds || isNaN(chunkSeconds) || chunkSeconds < 10 || chunkSeconds > 3600) {
    return res.status(400).json({
      success: false,
      error: 'A duração dos cortes (chunkSeconds) deve ser um número inteiro entre 10 e 3600 segundos.',
    });
  }

  const storagePath = payload.storagePath;
  if (!storagePath || typeof storagePath !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Caminho do arquivo (storagePath) no bucket seguro é obrigatório. URLs arbitrárias não são permitidas.',
    });
  }

  const sanitizedPath = path.normalize(storagePath).replace(/\\/g, '/');
  if (
    sanitizedPath.includes('..') ||
    sanitizedPath.includes('\0') ||
    sanitizedPath.startsWith('/')
  ) {
    return res.status(400).json({
      success: false,
      error: 'Caminho de armazenamento inválido (tentativa de navegação de diretório rejeitada).',
    });
  }

  if (!sanitizedPath.startsWith(`${userId}/`)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: o vídeo indicado não pertence à sua conta.',
    });
  }

  const validExts = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;
  if (!validExts.test(sanitizedPath)) {
    return res.status(400).json({
      success: false,
      error: 'Formato de vídeo não suportado. Utilize arquivos com extensão .mp4, .mov, .webm ou .mkv.',
    });
  }

  const jobDir = path.resolve(TEMP_ROOT, jobId);
  try {
    fs.mkdirSync(jobDir, { recursive: true });
  } catch (dirErr: any) {
    return res.status(500).json({
      success: false,
      error: `Falha ao criar diretório temporário do trabalho: ${dirErr.message}`,
    });
  }

  const inputVideoPath = path.resolve(jobDir, 'input.mp4');
  const jobTrack: ActiveSplitJob = {
    jobId,
    userId,
    cancelled: false,
    progressPercent: 5,
    currentPart: 0,
    totalParts: 1,
    status: 'Baixando vídeo original do armazenamento seguro...',
    tempFiles: [inputVideoPath],
    jobDir,
    uploadedStoragePaths: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  activeJobs.set(jobId, jobTrack);

  try {
    await downloadVideoFromStorage(sanitizedPath, inputVideoPath, userId);

    if (jobTrack.cancelled) {
      throw new Error('Processamento cancelado pelo usuário.');
    }

    jobTrack.status = 'Analisando propriedades do vídeo com ffprobe...';
    jobTrack.progressPercent = 10;
    jobTrack.updatedAt = Date.now();

    const probe = await probeVideoDetails(inputVideoPath);

    if (probe.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `O arquivo excede o limite máximo permitido de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB para processamento.`
      );
    }

    if (probe.duration > MAX_VIDEO_DURATION_SEC) {
      throw new Error(
        `A duração do vídeo (${Math.round(probe.duration)}s) excede o limite máximo permitido de 3 horas.`
      );
    }

    const totalDuration = probe.duration;

    let estimatedParts = 1;
    if (totalDuration > chunkSeconds) {
      const fullParts = Math.floor(totalDuration / chunkSeconds);
      const remainder = totalDuration - fullParts * chunkSeconds;
      estimatedParts = remainder >= 2.0 ? fullParts + 1 : Math.max(1, fullParts);
    }

    if (estimatedParts > MAX_PARTS_ALLOWED) {
      throw new Error(
        `A divisão resultaria em ${estimatedParts} partes, excedendo o limite máximo de ${MAX_PARTS_ALLOWED} partes. Aumente a duração de cada corte.`
      );
    }

    jobTrack.totalParts = estimatedParts;

    const generatedParts: VideoPartItem[] = [];
    const sanitizedTitle = (payload.title || 'Vídeo')
      .replace(/[\0\r\n\t]/g, '')
      .replace(/\.[^/.]+$/, '')
      .trim() || 'Vídeo';
    const nowTime = Date.now();

    for (let partIndex = 1; partIndex <= estimatedParts; partIndex++) {
      if (jobTrack.cancelled) {
        throw new Error('Processamento cancelado pelo usuário.');
      }

      const startSec = (partIndex - 1) * chunkSeconds;
      const partDuration = Math.min(chunkSeconds, totalDuration - startSec);

      jobTrack.currentPart = partIndex;
      jobTrack.progressPercent = Math.min(
        92,
        Math.round(((partIndex - 0.7) / estimatedParts) * 80) + 12
      );
      jobTrack.status = `Renderizando Parte ${partIndex} de ${estimatedParts} com FFmpeg...`;
      jobTrack.updatedAt = Date.now();

      const outVideoPath = path.resolve(jobDir, `part_${partIndex}.mp4`);
      const outThumbPath = path.resolve(jobDir, `thumb_${partIndex}.jpg`);
      jobTrack.tempFiles.push(outVideoPath, outThumbPath);

      await cutVideoSegment(
        inputVideoPath,
        outVideoPath,
        startSec,
        partDuration,
        (proc) => {
          jobTrack.process = proc;
        }
      );

      if (jobTrack.cancelled) {
        throw new Error('Processamento cancelado pelo usuário.');
      }

      await extractThumbnail(outVideoPath, outThumbPath, 0.5);

      const partProbe = await probeVideoDetails(outVideoPath);
      if (!partProbe.hasVideo || partProbe.duration <= 0) {
        throw new Error(`Falha na integridade pós-corte da parte ${partIndex}.`);
      }

      jobTrack.status = `Enviando Parte ${partIndex} para o armazenamento seguro...`;
      jobTrack.updatedAt = Date.now();

      const partStoragePath = `${userId}/videos/cuts/${jobId}/part_${partIndex}.mp4`;
      const thumbStoragePath = `${userId}/videos/cuts/${jobId}/thumb_${partIndex}.jpg`;

      await uploadFileToStorage(outVideoPath, partStoragePath, 'video/mp4');
      jobTrack.uploadedStoragePaths.push(partStoragePath);

      let thumbUrl = '';
      if (fs.existsSync(outThumbPath)) {
        await uploadFileToStorage(outThumbPath, thumbStoragePath, 'image/jpeg');
        jobTrack.uploadedStoragePaths.push(thumbStoragePath);
        thumbUrl = await createSignedUrlForPath(thumbStoragePath, 604800); // 7 dias
      }

      const videoSignedUrl = await createSignedUrlForPath(partStoragePath, 604800);

      if (fs.existsSync(outVideoPath)) fs.unlinkSync(outVideoPath);
      if (fs.existsSync(outThumbPath)) fs.unlinkSync(outThumbPath);

      const partItem: VideoPartItem = {
        id: `vid-part-${nowTime}-${partIndex}`,
        userId,
        title: `${sanitizedTitle} - Parte ${partIndex}`,
        thumbnail: thumbUrl,
        videoUrl: videoSignedUrl,
        storagePath: partStoragePath,
        thumbnailStoragePath: thumbStoragePath,
        duration: formatDurationHelper(partProbe.duration),
        durationSeconds: Math.round(partProbe.duration),
        uploadedAt: 'Hoje, corte automático',
        createdAt: new Date().toISOString(),
        viewsTotal: 0,
        publishedCount: 0,
        status: 'disponivel',
        fileSize: formatFileSizeHelper(partProbe.fileSizeBytes),
        sizeBytes: partProbe.fileSizeBytes,
        uploadedBy: payload.uploadedBy || authUser.email || 'Usuário autenticado',
        storageProvider: 'Clipo Video Worker (Cloud Run FFmpeg)',
      };

      generatedParts.push(partItem);
    }

    jobTrack.progressPercent = 100;
    jobTrack.status = 'Cortes concluídos e armazenados com sucesso!';
    jobTrack.finishedAt = Date.now();
    jobTrack.updatedAt = Date.now();

    if (fs.existsSync(inputVideoPath)) {
      try {
        fs.unlinkSync(inputVideoPath);
      } catch {}
    }

    try {
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch {}

    setTimeout(() => {
      activeJobs.delete(jobId);
    }, JOB_RETENTION_MS);

    return res.json({
      success: true,
      jobId,
      totalDuration,
      chunkSeconds,
      parts: generatedParts,
    });
  } catch (err: any) {
    const isCancelled = jobTrack.cancelled || err.message?.includes('cancelado');
    jobTrack.error = err.message;
    jobTrack.finishedAt = Date.now();
    jobTrack.status = isCancelled ? 'Processamento cancelado pelo usuário' : 'Falha no processamento';

    console.error(`[WORKER ERRO NO JOB ${jobId}]:`, err.message);

    if (jobTrack.process) {
      killProcessTree(jobTrack.process);
    }

    try {
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch {}

    await cleanupJobCutsFromStorage(userId, jobId);

    setTimeout(() => {
      activeJobs.delete(jobId);
    }, JOB_RETENTION_MS);

    return res.status(isCancelled ? 499 : 500).json({
      success: false,
      jobId,
      error: err.message || 'Erro interno no processamento de vídeo.',
    });
  }
});

// -----------------------------------------------------------------------------
// Endpoint Protegido: Consulta de Progresso de Legendas
// -----------------------------------------------------------------------------
function handleGetSubtitleProgress(req: Request, res: Response) {
  const authUser = (req as Request & { user: AuthenticatedUser }).user;
  const { jobId } = req.params;

  if (!jobId || !/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
    return res.status(400).json({
      success: false,
      error: 'Identificador de trabalho (jobId) inválido.',
    });
  }

  const job = activeSubtitleJobs.get(jobId);

  if (!job) {
    return res.json({
      success: true,
      found: false,
      progressPercent: 100,
      status: 'Trabalho de legendas concluído ou não encontrado nesta instância',
      cancelled: false,
    });
  }

  if (job.userId !== authUser.id) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: este trabalho de legendas pertence a outro usuário.',
    });
  }

  return res.json({
    success: true,
    found: true,
    progressPercent: job.progressPercent,
    status: job.status,
    cancelled: job.cancelled,
    error: job.error,
    result: job.result,
  });
}

app.get('/api/videos/subtitles-progress/:jobId', requireAuth, handleGetSubtitleProgress);
app.get('/api/videos/subtitles/progress/:jobId', requireAuth, handleGetSubtitleProgress);

// -----------------------------------------------------------------------------
// Endpoint Protegido: Cancelamento de Legendas
// -----------------------------------------------------------------------------
async function handleCancelSubtitles(req: Request, res: Response) {
  const authUser = (req as Request & { user: AuthenticatedUser }).user;
  const { jobId } = req.params;

  if (!jobId || !/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
    return res.status(400).json({
      success: false,
      error: 'Identificador de trabalho (jobId) inválido.',
    });
  }

  const job = activeSubtitleJobs.get(jobId);

  if (!job) {
    return res.json({
      success: true,
      message: 'Trabalho de legendas não encontrado ou já finalizado nesta instância.',
    });
  }

  if (job.userId !== authUser.id) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: você não tem permissão para cancelar este trabalho de legendas.',
    });
  }

  job.cancelled = true;
  job.status = 'Geração de legendas cancelada pelo usuário';
  job.finishedAt = Date.now();
  job.updatedAt = Date.now();

  if (job.process) {
    killProcessTree(job.process);
  }

  try {
    if (fs.existsSync(job.jobDir)) {
      fs.rmSync(job.jobDir, { recursive: true, force: true });
    }
  } catch (cleanErr: any) {
    console.warn(`[Worker Cleanup] Erro ao limpar pasta temporária do job de legendas ${jobId}:`, cleanErr.message);
  }

  await cleanupJobSubtitlesFromStorage(job.userId, jobId);

  setTimeout(() => {
    activeSubtitleJobs.delete(jobId);
  }, JOB_RETENTION_MS);

  return res.json({
    success: true,
    message: 'Geração de legendas cancelada e recursos limpos com sucesso.',
  });
}

app.post('/api/videos/cancel-subtitles/:jobId', requireAuth, handleCancelSubtitles);
app.post('/api/videos/subtitles/cancel/:jobId', requireAuth, handleCancelSubtitles);

// -----------------------------------------------------------------------------
// Endpoint Protegido Principal: Geração Automática de Legendas
// -----------------------------------------------------------------------------
async function handleGenerateSubtitles(req: Request, res: Response) {
  const authUser = (req as Request & { user: AuthenticatedUser }).user;
  const payload: SubtitlesRequestPayload = req.body;

  const userId = authUser.id;
  if (payload.userId && payload.userId !== userId) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: o userId informado na requisição não corresponde ao usuário autenticado.',
    });
  }

  // 1. Verificar configuração do Speech-to-Text antes de consumir recursos
  const speechConfig = checkSpeechConfigStatus();
  if (!speechConfig.isConfigured) {
    return res.status(503).json({
      success: false,
      error:
        'A API Google Cloud Speech-to-Text não está configurada no ambiente do worker. ' +
        'Configure as credenciais do Google Cloud (Service Account com a função "Speech Client" no Cloud Run, ' +
        'GOOGLE_APPLICATION_CREDENTIALS ou GOOGLE_CREDENTIALS_JSON).',
      details: speechConfig.details,
    });
  }

  // 2. Limites de Concorrência
  let runningTotal = 0;
  let runningForUser = 0;
  for (const item of activeSubtitleJobs.values()) {
    if (!item.cancelled && !item.finishedAt) {
      runningTotal++;
      if (item.userId === userId) {
        runningForUser++;
      }
    }
  }

  if (runningForUser >= MAX_JOBS_PER_USER) {
    return res.status(409).json({
      success: false,
      error: 'Já existe uma geração de legendas em andamento para a sua conta. Aguarde a conclusão ou cancele o trabalho anterior.',
    });
  }

  if (runningTotal >= MAX_CONCURRENT_JOBS) {
    return res.status(503).json({
      success: false,
      error: 'O servidor de legendas está com a capacidade máxima ocupada no momento. Tente novamente em alguns minutos.',
    });
  }

  // 3. Validação do JobId
  let jobId = payload.jobId;
  if (!jobId || !/^[a-zA-Z0-9_-]{1,64}$/.test(jobId)) {
    jobId = `sub_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  }

  // 4. Validação rigorosa do storagePath
  const storagePath = payload.storagePath;
  if (!storagePath || typeof storagePath !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Caminho do arquivo de vídeo (storagePath) no bucket seguro é obrigatório.',
    });
  }

  const sanitizedPath = path.normalize(storagePath).replace(/\\/g, '/');
  if (
    sanitizedPath.includes('..') ||
    sanitizedPath.includes('\0') ||
    sanitizedPath.startsWith('/')
  ) {
    return res.status(400).json({
      success: false,
      error: 'Caminho de armazenamento inválido (tentativa de navegação de diretório rejeitada).',
    });
  }

  if (!sanitizedPath.startsWith(`${userId}/`)) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado: o vídeo indicado não pertence à sua conta.',
    });
  }

  const validExts = /\.(mp4|mov|webm|m4v|avi|mkv)$/i;
  if (!validExts.test(sanitizedPath)) {
    return res.status(400).json({
      success: false,
      error: 'Formato de vídeo não suportado. Utilize arquivos com extensão .mp4, .mov, .webm ou .mkv.',
    });
  }

  const languageCode = (payload.languageCode || 'pt-BR').trim();

  // 5. Preparação da pasta temporária isolada por job
  const jobDir = path.resolve(TEMP_ROOT, jobId);
  try {
    fs.mkdirSync(jobDir, { recursive: true });
  } catch (dirErr: any) {
    return res.status(500).json({
      success: false,
      error: `Falha ao criar diretório temporário do trabalho: ${dirErr.message}`,
    });
  }

  const inputVideoPath = path.resolve(jobDir, 'input_video.mp4');
  const jobTrack: ActiveSubtitleJob = {
    jobId,
    userId,
    storagePath: sanitizedPath,
    cancelled: false,
    progressPercent: 5,
    status: 'Baixando vídeo original do armazenamento seguro...',
    tempFiles: [inputVideoPath],
    jobDir,
    uploadedStoragePaths: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  activeSubtitleJobs.set(jobId, jobTrack);

  try {
    // 6. Download do vídeo original (apenas leitura; original permanece 100% intacto)
    await downloadVideoFromStorage(sanitizedPath, inputVideoPath, userId);

    if (jobTrack.cancelled) {
      throw new Error('Processamento cancelado pelo usuário.');
    }

    // 7. Inspeção do vídeo com ffprobe
    jobTrack.status = 'Analisando vídeo com ffprobe...';
    jobTrack.progressPercent = 12;
    jobTrack.updatedAt = Date.now();

    const probe = await probeVideoDetails(inputVideoPath);

    if (!probe.hasAudio) {
      throw new Error('O vídeo não possui faixa de áudio audível para transcrição de legendas.');
    }

    if (probe.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error(
        `O arquivo excede o limite máximo permitido de ${MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`
      );
    }

    if (probe.duration > MAX_VIDEO_DURATION_SEC) {
      throw new Error(
        `A duração do vídeo (${Math.round(probe.duration)}s) excede o limite máximo permitido de 3 horas.`
      );
    }

    // 8. Extração e Transcrição com Speech-to-Text
    const transcriptOutput = await transcribeVideoToSubtitles(
      inputVideoPath,
      jobDir,
      probe.duration,
      languageCode,
      (percent, statusText) => {
        jobTrack.progressPercent = percent;
        jobTrack.status = statusText;
        jobTrack.updatedAt = Date.now();
      },
      (proc) => {
        jobTrack.process = proc;
      }
    );

    if (jobTrack.cancelled) {
      throw new Error('Processamento cancelado pelo usuário.');
    }

    jobTrack.status = 'Enviando arquivos de legenda para o armazenamento seguro...';
    jobTrack.progressPercent = 95;
    jobTrack.updatedAt = Date.now();

    // 9. Upload dos arquivos .vtt, .srt e .json para o Supabase Storage no caminho do usuário
    const vttStoragePath = `${userId}/videos/subtitles/${jobId}/subtitles.vtt`;
    const srtStoragePath = `${userId}/videos/subtitles/${jobId}/subtitles.srt`;
    const jsonStoragePath = `${userId}/videos/subtitles/${jobId}/subtitles.json`;

    await uploadFileToStorage(transcriptOutput.vttPath, vttStoragePath, 'text/vtt; charset=utf-8');
    jobTrack.uploadedStoragePaths.push(vttStoragePath);

    await uploadFileToStorage(transcriptOutput.srtPath, srtStoragePath, 'text/plain; charset=utf-8');
    jobTrack.uploadedStoragePaths.push(srtStoragePath);

    await uploadFileToStorage(transcriptOutput.jsonPath, jsonStoragePath, 'application/json; charset=utf-8');
    jobTrack.uploadedStoragePaths.push(jsonStoragePath);

    // Gerar URLs assinadas (Signed URLs) válidas por 7 dias
    const [vttSignedUrl, srtSignedUrl, jsonSignedUrl] = await Promise.all([
      createSignedUrlForPath(vttStoragePath, 604800),
      createSignedUrlForPath(srtStoragePath, 604800),
      createSignedUrlForPath(jsonStoragePath, 604800),
    ]);

    const resultData: SubtitleFilesResult = {
      language: languageCode,
      duration: probe.duration,
      fullText: transcriptOutput.fullText,
      segmentsCount: transcriptOutput.segments.length,
      wordsCount: transcriptOutput.segments.reduce((acc, s) => acc + (s.words?.length || 0), 0),
      segments: transcriptOutput.segments,
      storagePaths: {
        vtt: vttStoragePath,
        srt: srtStoragePath,
        json: jsonStoragePath,
      },
      signedUrls: {
        vtt: vttSignedUrl,
        srt: srtSignedUrl,
        json: jsonSignedUrl,
      },
    };

    jobTrack.result = resultData;
    jobTrack.progressPercent = 100;
    jobTrack.status = 'Legendas geradas e armazenadas com sucesso!';
    jobTrack.finishedAt = Date.now();
    jobTrack.updatedAt = Date.now();

    // 10. Limpeza dos arquivos locais
    try {
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch {}

    setTimeout(() => {
      activeSubtitleJobs.delete(jobId);
    }, JOB_RETENTION_MS);

    return res.json({
      success: true,
      jobId,
      ...resultData,
    });
  } catch (err: any) {
    const isCancelled = jobTrack.cancelled || err.message?.includes('cancelado');
    jobTrack.error = err.message;
    jobTrack.finishedAt = Date.now();
    jobTrack.status = isCancelled ? 'Geração cancelada pelo usuário' : 'Falha na geração de legendas';

    console.error(`[WORKER ERRO NO JOB DE LEGENDAS ${jobId}]:`, err.message);

    if (jobTrack.process) {
      killProcessTree(jobTrack.process);
    }

    try {
      if (fs.existsSync(jobDir)) {
        fs.rmSync(jobDir, { recursive: true, force: true });
      }
    } catch {}

    await cleanupJobSubtitlesFromStorage(userId, jobId);

    setTimeout(() => {
      activeSubtitleJobs.delete(jobId);
    }, JOB_RETENTION_MS);

    return res.status(isCancelled ? 499 : 500).json({
      success: false,
      jobId,
      error: err.message || 'Erro interno ao gerar legendas automáticas.',
    });
  }
}

app.post('/api/videos/subtitles', requireAuth, handleGenerateSubtitles);
app.post('/api/videos/subtitles/generate', requireAuth, handleGenerateSubtitles);

// -----------------------------------------------------------------------------
// Encerramento Gracioso de Container (Graceful Shutdown para Cloud Run)
// -----------------------------------------------------------------------------
function handleShutdown(signal: string) {
  console.log(`[Clipo Video Worker] Recebido sinal ${signal}. Encerrando processos com segurança...`);

  // Finalizar jobs de corte
  for (const [id, job] of activeJobs.entries()) {
    if (job.process) {
      console.log(`[Worker Shutdown] Encerrando FFmpeg do job de corte ${id}...`);
      killProcessTree(job.process);
    }
    try {
      if (fs.existsSync(job.jobDir)) {
        fs.rmSync(job.jobDir, { recursive: true, force: true });
      }
    } catch {}
  }

  // Finalizar jobs de legendas
  for (const [id, job] of activeSubtitleJobs.entries()) {
    if (job.process) {
      console.log(`[Worker Shutdown] Encerrando processo do job de legendas ${id}...`);
      killProcessTree(job.process);
    }
    try {
      if (fs.existsSync(job.jobDir)) {
        fs.rmSync(job.jobDir, { recursive: true, force: true });
      }
    } catch {}
  }

  process.exit(0);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

app.listen(PORT, () => {
  console.log(`[Clipo Video Worker] Servidor ativo e protegido na porta ${PORT}`);
  console.log(`[Clipo Video Worker] Ambiente: ${process.env.NODE_ENV || 'production'}`);
  console.log(`[Clipo Video Worker] Origens CORS autorizadas:`, Array.from(allowedOriginsSet));
  console.log(`[Clipo Video Worker] Diretório temporário: ${TEMP_ROOT}`);
  const speechStatus = checkSpeechConfigStatus();
  console.log(`[Clipo Video Worker] Google Cloud Speech-to-Text: ${speechStatus.details}`);
});
