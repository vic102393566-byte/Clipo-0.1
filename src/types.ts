export type TabType =
  | 'dashboard'
  | 'videos'
  | 'agendamentos'
  | 'calendario'
  | 'contas'
  | 'armazenamento'
  | 'plano'
  | 'configuracoes';

export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube' | 'linkedin';

export interface SocialAccount {
  id: string;
  platform: SocialPlatform;
  handle: string;
  name: string;
  avatar: string;
  connected: boolean;
  followers?: string;
  openId?: string;
  unionId?: string;
  scope?: string;
  connectedAt?: string;
  tokenExpiresAt?: number;
}

export type PublicationStatus = 'agendado' | 'processando' | 'publicado' | 'falhou' | 'cancelado';

export interface PlatformPublishResult {
  platform: SocialPlatform;
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  publishedAt?: string;
}

export interface PublishNotificationEvent {
  id: string;
  userId: string;
  type: 'publish_success' | 'publish_failure' | 'push_test';
  title: string;
  body: string;
  publicationId?: string;
  platforms: SocialPlatform[];
  platformResults?: PlatformPublishResult[];
  createdAt: string;
}

export interface AIMetadata {
  title: string;
  description: string;
  hashtags: string[];
  callToAction: string;
  modelUsed?: string;
  generatedAt?: string;
}

export interface ScheduledPublication {
  id: string;
  userId?: string; // Foreign key: ID do usuário proprietário
  videoId?: string; // Foreign key: ID do vídeo base
  videoUrl?: string; // URL direta, assinada ou blob stream para reprodução do vídeo
  storagePath?: string; // Caminho do arquivo no bucket do storage
  title: string;
  description: string;
  thumbnail: string;
  duration: string;
  scheduledTime: string; // e.g. "18:30"
  scheduledDateLabel: string; // e.g. "Hoje", "24 Set"
  dateISO?: string; // e.g. "2026-09-24"
  platforms: SocialPlatform[];
  status: PublicationStatus;
  aspectRatio: '9:16' | '16:9' | '1:1';
  fileSize: string;
  hashtags?: string[];
  callToAction?: string;
  aiMetadata?: AIMetadata;
  errorMessage?: string;
  platformResults?: PlatformPublishResult[];
  publishedAt?: string;
  pushNotified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type VideoStatus = 'disponivel' | 'processando' | 'em_agendamento' | 'publicado' | 'erro';

export interface VideoItem {
  id: string;
  userId?: string; // Foreign key: ID do usuário proprietário
  title: string;
  thumbnail: string;
  videoUrl?: string; // URL ou blob stream para reprodução
  storagePath?: string; // Caminho do arquivo no bucket (S3/GCS/Supabase)
  duration: string;
  durationSeconds?: number;
  uploadedAt: string;
  createdAt?: string; // ISO 8601 timestamp
  viewsTotal: number;
  publishedCount: number;
  status: VideoStatus;
  fileSize: string;
  sizeBytes?: number;
  uploadedBy?: string;
  storageProvider?: string;
  description?: string;
  hashtags?: string[];
  aiMetadata?: AIMetadata;
}

export type PlanTier = 'basico' | 'pro' | 'premium';

export type SubscriptionStatus = 'ativa' | 'pendente' | 'cancelada' | 'expirada';

export interface SubscriptionDetails {
  planId: PlanTier;
  status: SubscriptionStatus;
  startedAt: string;
  renewsAt?: string;
  lastPaymentId?: string;
  paymentMethod?: 'cartao' | 'pix' | 'boleto';
  billingInterval?: 'mensal' | 'anual';
}

export interface WebhookPaymentEvent {
  event: 'payment.succeeded' | 'payment.pending' | 'payment.failed' | 'subscription.canceled';
  paymentId: string;
  planId: PlanTier;
  userEmail: string;
  amount: number;
  currency: string;
  timestamp: string;
  status: SubscriptionStatus;
}

export interface PlanConfig {
  id: PlanTier;
  name: string;
  monthlyLimitBytes: number; // e.g. 5 GB, 50 GB, 200 GB
  labelLimit: string;
  monthlyVideoLimit: number; // Limite de uploads/cortes por mês
  labelVideoLimit: string;
  maxVideoDurationSeconds: number; // e.g. 1800s (30m), 7200s (2h), 14400s (4h)
  labelMaxVideoDuration: string;
  maxFileSizeBytes: number; // Limite por arquivo individual (e.g. 2 GB, 10 GB, 25 GB)
  labelMaxFileSize: string;
  priceMonthly: string;
  maxSocialAccounts: number;
  features: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
  createdAt: string;
  planId?: PlanTier;
}

export interface UserPreferences {
  publishSuccessNotification: boolean;
  publishFailureNotification: boolean;
  storageAlertNotification: boolean;
  marketingEmails: boolean;
  defaultCutDurationSeconds: number;
  autoGenerateTitles: boolean;
}

export interface UserSettingsRecord {
  userId: string;
  profile: {
    name: string;
    email: string;
    avatarUrl: string;
    bio?: string;
  };
  preferences: UserPreferences;
  updatedAt: string;
}

export interface AuthSession {
  token: string;
  user: User;
  expiresAt: number;
}
