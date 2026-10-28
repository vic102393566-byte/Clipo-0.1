import { ChildProcess } from 'node:child_process';

export interface VideoProbeResult {
  duration: number;
  hasVideo: boolean;
  hasAudio: boolean;
  videoCodec: string;
  audioCodec: string;
  width?: number;
  height?: number;
  fileSizeBytes: number;
}

export interface SplitRequestPayload {
  jobId?: string;
  chunkSeconds?: number | string;
  duration?: number | string;
  selectedOption?: string;
  userId?: string;
  title?: string;
  sourceVideoId?: string;
  uploadedBy?: string;
  storagePath: string;
}

export interface VideoPartItem {
  id: string;
  userId: string;
  title: string;
  thumbnail: string;
  videoUrl: string;
  storagePath: string;
  thumbnailStoragePath?: string;
  duration: string;
  durationSeconds: number;
  uploadedAt: string;
  createdAt: string;
  viewsTotal: number;
  publishedCount: number;
  status: 'disponivel';
  fileSize: string;
  sizeBytes: number;
  uploadedBy: string;
  storageProvider: string;
}

export interface ActiveSplitJob {
  jobId: string;
  userId: string;
  cancelled: boolean;
  progressPercent: number;
  currentPart: number;
  totalParts: number;
  status: string;
  error?: string;
  tempFiles: string[];
  jobDir: string;
  uploadedStoragePaths: string[];
  process?: ChildProcess;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

// -----------------------------------------------------------------------------
// Tipos para Geração Automática de Legendas
// -----------------------------------------------------------------------------

export interface SubtitleWord {
  word: string;
  start: number; // segundos com precisão decimal
  end: number;
  confidence?: number;
}

export interface SubtitleSegment {
  id: number;
  start: number; // segundos
  end: number; // segundos
  text: string;
  words?: SubtitleWord[];
}

export interface SubtitleFilesResult {
  language: string;
  duration: number;
  fullText: string;
  segmentsCount: number;
  wordsCount: number;
  segments: SubtitleSegment[];
  storagePaths: {
    vtt: string;
    srt: string;
    json: string;
  };
  signedUrls: {
    vtt: string;
    srt: string;
    json: string;
  };
}

export interface SubtitlesRequestPayload {
  jobId?: string;
  storagePath: string;
  languageCode?: string; // padrão: 'pt-BR'
  userId?: string;
  videoId?: string;
  title?: string;
}

export interface ActiveSubtitleJob {
  jobId: string;
  userId: string;
  storagePath: string;
  cancelled: boolean;
  progressPercent: number;
  status: string;
  error?: string;
  tempFiles: string[];
  jobDir: string;
  uploadedStoragePaths: string[];
  process?: ChildProcess;
  createdAt: number;
  updatedAt: number;
  finishedAt?: number;
  result?: SubtitleFilesResult;
}
