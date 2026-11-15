import { PlatformPublishResult, ScheduledPublication } from '../types';

export interface MultiPlatformPublishResponse {
  success: boolean;
  status: 'publicado' | 'falhou';
  platformResults: PlatformPublishResult[];
  error?: string;
  pushSent?: boolean;
  publishedAt?: string;
}

export async function publishPublicationMultiPlatform(
  publication: ScheduledPublication,
  userId: string,
  options: { notifyOnSuccess?: boolean; notifyOnFailure?: boolean } = {}
): Promise<MultiPlatformPublishResponse> {
  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicationId: publication.id,
        userId,
        title: publication.title,
        description: publication.description,
        videoUrl: publication.videoUrl,
        storagePath: publication.storagePath,
        thumbnail: publication.thumbnail,
        duration: publication.duration,
        platforms: publication.platforms,
        hashtags: publication.hashtags,
        callToAction: publication.callToAction,
        notifyOnSuccess: options.notifyOnSuccess ?? true,
        notifyOnFailure: options.notifyOnFailure ?? true,
      }),
    });

    const data = await res.json();
    return {
      success: Boolean(data.success),
      status: data.success ? 'publicado' : 'falhou',
      platformResults: Array.isArray(data.platformResults) ? data.platformResults : [],
      error: data.error,
      pushSent: Boolean(data.pushSent),
      publishedAt: data.publishedAt,
    };
  } catch (err: any) {
    return {
      success: false,
      status: 'falhou',
      platformResults: [],
      error: err?.message || 'Erro de comunicação ao publicar nas redes sociais.',
    };
  }
}

export async function syncSchedulesWithServer(
  userId: string,
  publications: ScheduledPublication[]
): Promise<ScheduledPublication[] | null> {
  try {
    const res = await fetch('/api/schedules/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, publications }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.publications) ? data.publications : null;
  } catch {
    return null;
  }
}

export async function fetchServerSchedules(userId: string): Promise<ScheduledPublication[] | null> {
  try {
    const res = await fetch(`/api/schedules?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data.publications) ? data.publications : null;
  } catch {
    return null;
  }
}
