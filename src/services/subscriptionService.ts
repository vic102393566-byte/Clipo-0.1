import { PlanTier, SubscriptionDetails, SubscriptionStatus, WebhookPaymentEvent } from '../types';
import { getStoredSubscription, saveStoredSubscription, saveStoredPlan } from './storageService';

/**
 * Fetches current subscription state from backend (with local fallback)
 */
export async function fetchCurrentSubscription(): Promise<SubscriptionDetails> {
  try {
    const res = await fetch('/api/subscription/current');
    if (res.ok) {
      const data = await res.json();
      if (data?.subscription) {
        saveStoredSubscription(data.subscription);
        return data.subscription;
      }
    }
  } catch (err) {
    console.warn('Backend subscription endpoint unavailable, using local cache:', err);
  }
  return getStoredSubscription();
}

/**
 * Simulates confirming a payment (for UI testing of the webhook / checkout confirmation flow)
 * Calls the backend simulation route and updates local subscription state.
 */
export async function confirmPaymentAndActivatePlan(
  planId: PlanTier,
  paymentMethod: 'cartao' | 'pix' | 'boleto' = 'cartao'
): Promise<SubscriptionDetails> {
  const updatedSub: SubscriptionDetails = {
    planId,
    status: 'ativa',
    startedAt: new Date().toISOString(),
    renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    lastPaymentId: `pay_clipo_${Date.now()}`,
    paymentMethod,
    billingInterval: 'mensal',
  };

  try {
    const res = await fetch('/api/subscription/simulate-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId,
        status: 'ativa',
        paymentMethod,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.subscription) {
        saveStoredSubscription(data.subscription);
        return data.subscription;
      }
    }
  } catch (err) {
    console.warn('Could not post to backend simulation, persisting locally:', err);
  }

  saveStoredSubscription(updatedSub);
  saveStoredPlan(planId);
  return updatedSub;
}

/**
 * Simulates triggering a payment webhook payload to test the backend webhook pipeline
 */
export async function triggerPaymentWebhook(
  event: 'payment.succeeded' | 'payment.pending' | 'payment.failed' | 'subscription.canceled',
  planId: PlanTier,
  userEmail: string = 'vic102393566@gmail.com'
): Promise<any> {
  const payload: WebhookPaymentEvent = {
    event,
    paymentId: `evt_${Date.now()}`,
    planId,
    userEmail,
    amount: planId === 'premium' ? 99.9 : planId === 'pro' ? 59.9 : 29.9,
    currency: 'BRL',
    timestamp: new Date().toISOString(),
    status:
      event === 'payment.succeeded'
        ? 'ativa'
        : event === 'payment.pending'
        ? 'pendente'
        : 'cancelada',
  };

  const res = await fetch('/api/webhook/payment', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': 'sig_test_clipo_secret',
    },
    body: JSON.stringify(payload),
  });

  return await res.json();
}

/**
 * Updates subscription status directly (e.g., cancel subscription, set pending)
 */
export async function updateSubscriptionStatus(status: SubscriptionStatus): Promise<SubscriptionDetails> {
  const current = getStoredSubscription();
  const updated: SubscriptionDetails = {
    ...current,
    status,
  };
  saveStoredSubscription(updated);

  try {
    await fetch('/api/subscription/simulate-confirmation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        planId: current.planId,
        status,
        paymentMethod: current.paymentMethod,
      }),
    });
  } catch (err) {
    console.warn('Backend sync failed:', err);
  }

  return updated;
}
