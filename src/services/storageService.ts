import { VideoItem, PlanTier, PlanConfig, SubscriptionDetails, SubscriptionStatus, ScheduledPublication, SocialAccount } from '../types';
import { authService, DEFAULT_DEMO_USER } from './authService';
import {
  isSupabaseConfigured,
  uploadVideoToSupabaseStorage,
  createSignedVideoUrl,
  deleteVideoFromSupabaseStorage,
  SUPABASE_VIDEOS_BUCKET,
  buildUserVideoStoragePath,
  isProductionEnvironment,
  getEffectiveSupabaseUserId,
  categorizeUploadError,
  isUUID,
  ensureSupabaseConfigured,
  getSupabaseUrl,
  getSupabaseAnonKey,
} from './supabaseClient';

export {
  isSupabaseConfigured,
  uploadVideoToSupabaseStorage,
  createSignedVideoUrl,
  deleteVideoFromSupabaseStorage,
  SUPABASE_VIDEOS_BUCKET,
  buildUserVideoStoragePath,
  isProductionEnvironment,
  getEffectiveSupabaseUserId,
  categorizeUploadError,
  isUUID,
  ensureSupabaseConfigured,
  getSupabaseUrl,
  getSupabaseAnonKey,
};

/**
 * Storage provider interface.
 * Decouples the physical or browser storage backend from the application logic.
 * Future providers could be S3StorageProvider, GCSStorageProvider, SupabaseStorageProvider, etc.
 */
export interface StorageProvider {
  name: string;
  saveVideoBinary(id: string, file: File | Blob, options?: { userId?: string; fileName?: string; onProgress?: (p: number) => void }): Promise<string>;
  getVideoUrl(id: string, storagePath?: string): Promise<string | undefined>;
  deleteVideoBinary(id: string, storagePath?: string): Promise<void>;
  estimateTotalSize(): Promise<number>;
}

/**
 * IndexedDB storage provider:
 * Stores video blobs safely in the browser's persistent IndexedDB database.
 * Survives full page reloads, browser restarts, and tab closures without memory bloat.
 */
class IndexedDBStorageProvider implements StorageProvider {
  name = 'IndexedDB Local Storage';
  private dbPromise: Promise<IDBDatabase> | null = null;
  private dbName = 'ClipoStorageDB';
  private storeName = 'video_binaries';

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async saveVideoBinary(id: string, file: File | Blob): Promise<string> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.put(file, id);

      req.onsuccess = () => {
        // Return object URL for live playback in current session
        const url = URL.createObjectURL(file);
        resolve(url);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getVideoUrl(id: string): Promise<string | undefined> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.get(id);

      req.onsuccess = () => {
        const blob = req.result as Blob | undefined;
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          resolve(undefined);
        }
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteVideoBinary(id: string, storagePath?: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async estimateTotalSize(): Promise<number> {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        return estimate.usage || 0;
      } catch {
        return 0;
      }
    }
    return 0;
  }
}

/**
 * Supabase Storage Provider:
 * Salva arquivos no bucket privado 'clipo-videos' sob a pasta do usuário:
 * {ID_DO_USUARIO}/videos/{nome-do-arquivo}
 * Utiliza URLs assinadas temporárias para reprodução segura.
 */
export class SupabaseStorageProvider implements StorageProvider {
  name = 'Supabase Storage (clipo-videos)';
  private fallbackProvider = new IndexedDBStorageProvider();

  async saveVideoBinary(
    id: string,
    file: File | Blob,
    options?: { userId?: string; fileName?: string; onProgress?: (p: number) => void }
  ): Promise<string> {
    if (!isSupabaseConfigured()) {
      return this.fallbackProvider.saveVideoBinary(id, file);
    }
    const fileName = (file instanceof File && file.name) ? file.name : (options?.fileName || `video_${id}.mp4`);
    const result = await uploadVideoToSupabaseStorage(file, fileName, {
      userId: options?.userId,
      onProgress: options?.onProgress ? (pct) => options.onProgress!(pct) : undefined,
    });
    return result.signedUrl;
  }

  async getVideoUrl(id: string, storagePath?: string): Promise<string | undefined> {
    if (storagePath && isSupabaseConfigured()) {
      const signedUrl = await createSignedVideoUrl(storagePath, 86400);
      if (signedUrl) return signedUrl;
    }
    return this.fallbackProvider.getVideoUrl(id);
  }

  async deleteVideoBinary(id: string, storagePath?: string): Promise<void> {
    if (storagePath && isSupabaseConfigured()) {
      await deleteVideoFromSupabaseStorage(storagePath);
    }
    await this.fallbackProvider.deleteVideoBinary(id);
  }

  async estimateTotalSize(): Promise<number> {
    return this.fallbackProvider.estimateTotalSize();
  }
}

// Active storage provider (Supabase Storage if configured, or IndexedDB as zero-config local fallback)
export const currentStorageProvider: StorageProvider = isSupabaseConfigured()
  ? new SupabaseStorageProvider()
  : new IndexedDBStorageProvider();

// Available plans and their storage limits
export const PLANS_CONFIG: Record<PlanTier, PlanConfig> = {
  basico: {
    id: 'basico',
    name: 'Básico',
    monthlyLimitBytes: 5 * 1024 * 1024 * 1024, // 5 GB espaço total
    labelLimit: '5 GB',
    monthlyVideoLimit: 30, // 30 vídeos/mês
    labelVideoLimit: '30 vídeos/mês',
    maxVideoDurationSeconds: 1800, // 30 minutos (limite atual)
    labelMaxVideoDuration: 'Até 30 minutos',
    maxFileSizeBytes: 2 * 1024 * 1024 * 1024, // 2 GB por arquivo
    labelMaxFileSize: '2 GB por vídeo',
    priceMonthly: 'R$ 29,90',
    maxSocialAccounts: 1,
    features: [
      '1 conta social conectada',
      '5 GB de armazenamento total',
      'Vídeos de até 30 minutos',
      'Até 30 vídeos/mês',
      'Corte automático inteligente',
      'Agendamento de publicações',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    monthlyLimitBytes: 50 * 1024 * 1024 * 1024, // 50 GB espaço total
    labelLimit: '50 GB',
    monthlyVideoLimit: 150, // 150 vídeos/mês
    labelVideoLimit: '150 vídeos/mês',
    maxVideoDurationSeconds: 7200, // 2 horas (7200 segundos) para podcasts, lives e aulas
    labelMaxVideoDuration: 'Até 2 horas',
    maxFileSizeBytes: 10 * 1024 * 1024 * 1024, // 10 GB por arquivo
    labelMaxFileSize: '10 GB por vídeo',
    priceMonthly: 'R$ 59,90',
    maxSocialAccounts: 3,
    features: [
      'Até 3 contas sociais conectadas',
      '50 GB de armazenamento total',
      'Vídeos longos de até 2 horas',
      'Arquivos de até 10 GB por vídeo',
      'Até 150 vídeos/mês',
      'Corte automático prioritário',
      'Agendamento multicanal simultâneo',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    monthlyLimitBytes: 200 * 1024 * 1024 * 1024, // 200 GB espaço total
    labelLimit: '200 GB',
    monthlyVideoLimit: 500, // 500 vídeos/mês
    labelVideoLimit: 'Vídeos ilimitados (500/mês)',
    maxVideoDurationSeconds: 14400, // 4 horas
    labelMaxVideoDuration: 'Até 4 horas',
    maxFileSizeBytes: 25 * 1024 * 1024 * 1024, // 25 GB por arquivo
    labelMaxFileSize: '25 GB por vídeo',
    priceMonthly: 'R$ 99,90',
    maxSocialAccounts: 3,
    features: [
      'Até 3 contas sociais conectadas',
      '200 GB de armazenamento total',
      'Vídeos de até 4 horas',
      'Arquivos de até 25 GB por vídeo',
      'Vídeos ilimitados (até 500/mês)',
      'Processamento de corte ultra-rápido',
      'Agendamento prioritário com retry',
    ],
  },
};

// Base storage is 0 bytes - only real files in media/uploads and media/cuts are counted
export const BASE_SEED_STORAGE_BYTES = 0;

const STORAGE_METADATA_KEY = 'clipo_videos_metadata_v1';
const STORAGE_PLAN_KEY = 'clipo_active_plan_v1';
const STORAGE_SUBSCRIPTION_KEY = 'clipo_subscription_details_v1';

export const DEFAULT_SUBSCRIPTION: SubscriptionDetails = {
  planId: 'pro',
  status: 'ativa',
  startedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
  renewsAt: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
  lastPaymentId: 'pay_live_8912304812',
  paymentMethod: 'cartao',
  billingInterval: 'mensal',
};

/**
 * Helper to build user-scoped storage key
 */
export function getUserScopedKey(suffix: string, userId?: string): string {
  const current = authService.getCurrentUser();
  const effectiveId = userId || current?.id || DEFAULT_DEMO_USER.id;
  return `clipo_u_${effectiveId}_${suffix}`;
}

export function isCurrentUserDemo(userId?: string): boolean {
  const current = authService.getCurrentUser();
  const effectiveId = userId || current?.id || DEFAULT_DEMO_USER.id;
  return effectiveId === DEFAULT_DEMO_USER.id;
}

/**
 * Loads video records from persistent metadata repository (user-scoped)
 */
export function getStoredVideosMetadata(userId?: string): VideoItem[] | null {
  try {
    const effectiveId = userId || authService.getCurrentUser()?.id || DEFAULT_DEMO_USER.id;
    const isDemo = isCurrentUserDemo(effectiveId);
    const scopedKey = getUserScopedKey('videos', effectiveId);
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed: VideoItem[] = JSON.parse(raw);
      // Garante que todos os vídeos retornados contenham o userId correto
      return parsed.map((item) => ({
        ...item,
        userId: item.userId || effectiveId,
      }));
    }

    // Se for usuário demo, tenta recuperar chave legada
    if (isDemo) {
      const legacy = localStorage.getItem(STORAGE_METADATA_KEY);
      if (legacy) {
        const parsed: VideoItem[] = JSON.parse(legacy);
        return parsed.map((item) => ({
          ...item,
          userId: item.userId || effectiveId,
        }));
      }
    }
    return null;
  } catch (err) {
    console.error('Failed reading videos metadata:', err);
    return null;
  }
}

/**
 * Saves video records to persistent metadata repository (user-scoped)
 */
export function saveVideosMetadata(videos: VideoItem[], userId?: string): void {
  try {
    const effectiveId = userId || authService.getCurrentUser()?.id || DEFAULT_DEMO_USER.id;
    const scopedKey = getUserScopedKey('videos', effectiveId);
    // Garante que todos os vídeos salvos estejam associados ao userId do proprietário
    const scopedVideos = videos.map((v) => ({
      ...v,
      userId: effectiveId,
    }));
    localStorage.setItem(scopedKey, JSON.stringify(scopedVideos));
    if (isCurrentUserDemo(effectiveId)) {
      localStorage.setItem(STORAGE_METADATA_KEY, JSON.stringify(scopedVideos));
    }
  } catch (err) {
    console.error('Failed persisting videos metadata:', err);
  }
}

/**
 * Retrieves the currently active subscription plan (user-scoped)
 */
export function getStoredPlan(userId?: string): PlanTier {
  try {
    const sub = getStoredSubscription(userId);
    if (sub && sub.planId && PLANS_CONFIG[sub.planId]) return sub.planId;
    const scopedKey = getUserScopedKey('plan', userId);
    const plan = localStorage.getItem(scopedKey) as PlanTier | null;
    if (plan && PLANS_CONFIG[plan]) return plan;
    if (isCurrentUserDemo(userId)) {
      const legacyPlan = localStorage.getItem(STORAGE_PLAN_KEY) as PlanTier | null;
      if (legacyPlan && PLANS_CONFIG[legacyPlan]) return legacyPlan;
    }
    return 'pro'; // Default to Pro Creator
  } catch {
    return 'pro';
  }
}

/**
 * Updates subscription plan (user-scoped)
 */
export function saveStoredPlan(plan: PlanTier, userId?: string): void {
  try {
    const scopedKey = getUserScopedKey('plan', userId);
    localStorage.setItem(scopedKey, plan);
    if (isCurrentUserDemo(userId)) {
      localStorage.setItem(STORAGE_PLAN_KEY, plan);
    }
    const sub = getStoredSubscription(userId);
    saveStoredSubscription({
      ...sub,
      planId: plan,
      status: 'ativa',
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, userId);
  } catch (err) {
    console.error('Failed saving plan tier:', err);
  }
}

/**
 * Retrieves full subscription details (user-scoped)
 */
export function getStoredSubscription(userId?: string): SubscriptionDetails {
  try {
    const scopedKey = getUserScopedKey('subscription', userId);
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.planId && PLANS_CONFIG[parsed.planId as PlanTier]) {
        return parsed;
      }
    }
    if (isCurrentUserDemo(userId)) {
      const legacy = localStorage.getItem(STORAGE_SUBSCRIPTION_KEY);
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (parsedLegacy && parsedLegacy.planId && PLANS_CONFIG[parsedLegacy.planId as PlanTier]) {
          return parsedLegacy;
        }
      }
    }
  } catch (err) {
    console.warn('Failed reading subscription from localStorage:', err);
  }
  return DEFAULT_SUBSCRIPTION;
}

/**
 * Saves full subscription details (user-scoped)
 */
export function saveStoredSubscription(details: SubscriptionDetails, userId?: string): void {
  try {
    const scopedKey = getUserScopedKey('subscription', userId);
    localStorage.setItem(scopedKey, JSON.stringify(details));
    if (isCurrentUserDemo(userId)) {
      localStorage.setItem(STORAGE_SUBSCRIPTION_KEY, JSON.stringify(details));
      localStorage.setItem(STORAGE_PLAN_KEY, details.planId);
    }
  } catch (err) {
    console.error('Failed persisting subscription details:', err);
  }
}

/**
 * Retrieves scheduled publications for a specific user
 */
export function getStoredPublications(userId?: string): ScheduledPublication[] | null {
  try {
    const effectiveId = userId || authService.getCurrentUser()?.id || DEFAULT_DEMO_USER.id;
    const scopedKey = getUserScopedKey('publications', effectiveId);
    const raw = localStorage.getItem(scopedKey);
    if (raw) {
      const parsed: ScheduledPublication[] = JSON.parse(raw);
      return parsed.map((item) => ({
        ...item,
        userId: item.userId || effectiveId,
      }));
    }
    return null;
  } catch (err) {
    console.error('Failed reading user publications:', err);
    return null;
  }
}

/**
 * Saves scheduled publications for a specific user
 */
export function saveStoredPublications(publications: ScheduledPublication[], userId?: string): void {
  try {
    const effectiveId = userId || authService.getCurrentUser()?.id || DEFAULT_DEMO_USER.id;
    const scopedKey = getUserScopedKey('publications', effectiveId);
    const scopedPubs = publications.map((pub) => ({
      ...pub,
      userId: effectiveId,
    }));
    localStorage.setItem(scopedKey, JSON.stringify(scopedPubs));
  } catch (err) {
    console.error('Failed saving user publications:', err);
  }
}

/**
 * Loads connected social accounts for a specific user from user-scoped storage
 */
export function getStoredSocialAccounts(userId?: string): SocialAccount[] | null {
  try {
    const effectiveId = userId || authService.getCurrentUser()?.id || DEFAULT_DEMO_USER.id;
    const scopedKey = getUserScopedKey('social_accounts', effectiveId);
    const raw = localStorage.getItem(scopedKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed reading user social accounts:', err);
    return null;
  }
}

/**
 * Saves connected social accounts for a specific user in user-scoped storage
 */
export function saveStoredSocialAccounts(accounts: SocialAccount[], userId?: string): void {
  try {
    const effectiveId = userId || authService.getCurrentUser()?.id || DEFAULT_DEMO_USER.id;
    const scopedKey = getUserScopedKey('social_accounts', effectiveId);
    localStorage.setItem(scopedKey, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed saving user social accounts:', err);
  }
}

export interface StorageUsageData {
  totalUsedBytes: number;
  totalLimitBytes: number;
  usedFormatted: string;
  limitFormatted: string;
  percentUsed: number;
  isOverLimit: boolean;
  availableBytes: number;
}

/**
 * Calculates current total storage consumption considering ONLY real files
 * in media/uploads and media/cuts on the server.
 */
export function calculateStorageUsage(
  customVideos: VideoItem[],
  planTier: PlanTier,
  serverRealBytes?: number
): StorageUsageData {
  const plan = PLANS_CONFIG[planTier] || PLANS_CONFIG.pro;

  let totalUsedBytes = 0;
  if (typeof serverRealBytes === 'number' && serverRealBytes >= 0) {
    totalUsedBytes = serverRealBytes;
  } else {
    // Considera arquivos reais em media/uploads, media/cuts ou Supabase Storage (storagePath)
    const realVideos = (customVideos || []).filter((v) => {
      const url = v.videoUrl || '';
      return url.includes('/media/uploads') || url.includes('/media/cuts') || Boolean(v.storagePath);
    });
    totalUsedBytes = realVideos.reduce((acc, v) => acc + (v.sizeBytes || 0), 0);
  }

  const totalLimitBytes = plan.monthlyLimitBytes;
  const usedGb = totalUsedBytes / (1024 * 1024 * 1024);
  const limitGb = totalLimitBytes / (1024 * 1024 * 1024);
  const percentUsed = totalUsedBytes === 0 ? 0 : Math.min(100, parseFloat(((totalUsedBytes / totalLimitBytes) * 100).toFixed(1)));
  const isOverLimit = totalUsedBytes >= totalLimitBytes;
  const availableBytes = Math.max(0, totalLimitBytes - totalUsedBytes);

  let formattedUsed = '0,0 GB';
  if (totalUsedBytes > 0) {
    if (usedGb < 0.05) {
      formattedUsed = `${(totalUsedBytes / (1024 * 1024)).toFixed(1)} MB`;
    } else {
      formattedUsed = `${usedGb.toFixed(1)} GB`;
    }
  }

  return {
    totalUsedBytes,
    totalLimitBytes,
    usedFormatted: formattedUsed,
    limitFormatted: `${limitGb.toFixed(1)} GB`,
    percentUsed,
    isOverLimit,
    availableBytes,
  };
}

/**
 * Validates if a file with given byte size can fit into the plan limits:
 * 1. Maximum individual file size for the plan
 * 2. Total storage available in the account (considering only real files in media/uploads and media/cuts)
 */
export function canUploadFileSize(
  fileSizeBytes: number,
  customVideos: VideoItem[],
  planTier: PlanTier,
  serverRealBytes?: number
): { allowed: boolean; message?: string } {
  const plan = PLANS_CONFIG[planTier] || PLANS_CONFIG.pro;

  // 1. Limite de tamanho máximo de um único vídeo
  if (fileSizeBytes > plan.maxFileSizeBytes) {
    const fileFormatted = fileSizeBytes >= 1024 * 1024 * 1024
      ? `${(fileSizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
      : `${(fileSizeBytes / (1024 * 1024)).toFixed(0)} MB`;
    const upgradeSuggestion = planTier === 'basico' ? 'Pro (até 10 GB por vídeo / até 2h)' : 'Premium (até 25 GB por vídeo / até 4h)';

    return {
      allowed: false,
      message: `Tamanho máximo de arquivo excedido para o plano ${plan.name} (${plan.labelMaxFileSize}). O arquivo enviado possui ${fileFormatted}. Faça upgrade para o plano ${upgradeSuggestion} para enviar arquivos maiores.`,
    };
  }

  // 2. Limite de espaço total disponível na conta considerando apenas arquivos reais em media/uploads e media/cuts
  const usage = calculateStorageUsage(customVideos, planTier, serverRealBytes);
  const projectedTotal = usage.totalUsedBytes + fileSizeBytes;

  if (projectedTotal > usage.totalLimitBytes) {
    const availableMb = (usage.availableBytes / (1024 * 1024)).toFixed(0);
    const fileMb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
    const upgradeSuggestion = planTier === 'basico' ? 'Pro (50 GB)' : 'Premium (200 GB)';

    return {
      allowed: false,
      message: `Espaço total da conta insuficiente. O plano ${plan.name} possui limite total de ${usage.limitFormatted}. O arquivo possui ${fileMb} MB, mas restam apenas ${availableMb} MB livres na conta. Faça upgrade para o plano ${upgradeSuggestion} ou libere espaço excluindo mídias antigas.`,
    };
  }

  return { allowed: true };
}

/**
 * Validates if a video duration fits into the plan limit
 */
export function canUploadDuration(
  durationSeconds: number,
  planTier: PlanTier
): { allowed: boolean; message?: string } {
  const plan = PLANS_CONFIG[planTier] || PLANS_CONFIG.pro;

  if (durationSeconds > plan.maxVideoDurationSeconds) {
    const hours = (durationSeconds / 3600).toFixed(1);
    const upgradeSuggestion = planTier === 'basico' ? 'Pro (vídeos de até 2 horas)' : 'Premium (vídeos de até 4 horas)';

    return {
      allowed: false,
      message: `Duração máxima de vídeo excedida para o plano ${plan.name} (${plan.labelMaxVideoDuration}). O vídeo possui aproximadamente ${hours}h. Faça upgrade para o plano ${upgradeSuggestion} para processar conteúdos longos como podcasts e aulas.`,
    };
  }

  return { allowed: true };
}
