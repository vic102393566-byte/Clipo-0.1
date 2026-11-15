import { PublishNotificationEvent } from '../types';

export interface PushStatusInfo {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  subscribed: boolean;
  backendSubscriptionCount: number;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
}

export async function registerClipoServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return registration;
  } catch (err) {
    console.warn('[Push] Falha ao registrar Service Worker:', err);
    return null;
  }
}

export async function getPushStatus(userId: string): Promise<PushStatusInfo> {
  const supported = isPushSupported();
  const permission: NotificationPermission | 'unsupported' =
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported';

  let browserSubscribed = false;
  if (supported && permission === 'granted') {
    try {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      browserSubscribed = Boolean(sub);
    } catch {
      browserSubscribed = false;
    }
  }

  try {
    const res = await fetch(`/api/push/status?userId=${encodeURIComponent(userId)}`);
    if (res.ok) {
      const data = await res.json();
      return {
        supported,
        permission,
        subscribed: browserSubscribed || Boolean(data.subscribed),
        backendSubscriptionCount: data.subscriptionCount || 0,
        notifyOnSuccess: data.notifyOnSuccess !== false,
        notifyOnFailure: data.notifyOnFailure !== false,
      };
    }
  } catch (err) {
    console.warn('[Push] Erro ao consultar status no servidor:', err);
  }

  return {
    supported,
    permission,
    subscribed: browserSubscribed,
    backendSubscriptionCount: 0,
    notifyOnSuccess: true,
    notifyOnFailure: true,
  };
}

export async function subscribeToPushNotifications(
  userId: string,
  prefs: { notifyOnSuccess?: boolean; notifyOnFailure?: boolean } = {}
): Promise<{ success: boolean; permission?: NotificationPermission; error?: string }> {
  if (!isPushSupported()) {
    return {
      success: false,
      error: 'Este navegador ou contexto não suporta Web Push Notifications.',
    };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        error:
          permission === 'denied'
            ? 'Permissão de notificações bloqueada no navegador. Libere nas configurações do site.'
            : 'Permissão de notificações não concedida.',
      };
    }

    const registration = await registerClipoServiceWorker();
    if (!registration) {
      return {
        success: false,
        permission,
        error: 'Não foi possível registrar o Service Worker para notificações Push.',
      };
    }

    const keyRes = await fetch('/api/push/vapid-public-key');
    if (!keyRes.ok) {
      return {
        success: false,
        permission,
        error: 'Falha ao obter chave pública VAPID do servidor.',
      };
    }
    const { publicKey } = await keyRes.json();

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const saveRes = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        subscription: subscription.toJSON(),
        notifyOnSuccess: prefs.notifyOnSuccess ?? true,
        notifyOnFailure: prefs.notifyOnFailure ?? true,
      }),
    });

    if (!saveRes.ok) {
      const errData = await saveRes.json().catch(() => ({}));
      return {
        success: false,
        permission,
        error: errData.error || 'Erro ao registrar assinatura Push no servidor.',
      };
    }

    return { success: true, permission };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erro inesperado ao ativar notificações Push.',
    };
  }
}

export async function unsubscribeFromPushNotifications(userId: string): Promise<boolean> {
  try {
    let endpoint: string | undefined;
    if (isPushSupported()) {
      const reg = await navigator.serviceWorker.getRegistration('/');
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        endpoint = sub.endpoint;
        await sub.unsubscribe();
      }
    }

    await fetch('/api/push/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, endpoint }),
    });
    return true;
  } catch (err) {
    console.warn('[Push] Erro ao desativar push:', err);
    return false;
  }
}

export async function syncPushPreferences(
  userId: string,
  prefs: { notifyOnSuccess: boolean; notifyOnFailure: boolean }
): Promise<void> {
  try {
    await fetch('/api/push/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, ...prefs }),
    });
  } catch (err) {
    console.warn('[Push] Erro ao sincronizar preferências de notificação:', err);
  }
}

export async function sendTestPushNotification(
  userId: string
): Promise<{ success: boolean; deliveredCount?: number; message?: string; error?: string }> {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Falha ao enviar notificação de teste.',
    };
  }
}

/**
 * Fallback browser Notification trigger when Service Worker push is unavailable (e.g. restricted iframe)
 * while Notifications are granted and the user has publishSuccess enabled.
 */
export function showBrowserNotificationFallback(title: string, body: string): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: `clipo-live-${Date.now()}` });
    } catch {
      // Some sandboxed iframes block new Notification() directly; Service Worker handles real Push.
    }
  }
}

export function subscribeToNotificationStream(
  userId: string,
  onEvent: (event: PublishNotificationEvent) => void,
  onScheduleUpdated?: (publication: any) => void
): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined' || !userId) {
    return () => {};
  }

  const es = new EventSource(`/api/notifications/stream?userId=${encodeURIComponent(userId)}`);

  es.addEventListener('publish_notification', (msg: MessageEvent) => {
    try {
      const parsed: PublishNotificationEvent = JSON.parse(msg.data);
      onEvent(parsed);
    } catch (err) {
      console.warn('[SSE] Erro ao interpretar notificação:', err);
    }
  });

  es.addEventListener('schedule_updated', (msg: MessageEvent) => {
    if (!onScheduleUpdated) return;
    try {
      const parsed = JSON.parse(msg.data);
      onScheduleUpdated(parsed);
    } catch (err) {
      console.warn('[SSE] Erro ao interpretar atualização de agendamento:', err);
    }
  });

  return () => {
    es.close();
  };
}
