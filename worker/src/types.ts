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
