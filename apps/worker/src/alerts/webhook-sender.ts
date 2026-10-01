import { db, eq, and } from '@repo/db';
import { alerts, webhookSubscriptions, alertDeliveries } from '@repo/db/schema';
import { createHmac } from 'node:crypto';

type AlertTriggeredPayload = {
  alertId: string;
  hazardEventId: string;
  structureId: string;
  riskScore: number;
  bucket: string;
};

function assertAlertTriggered(payload: unknown): AlertTriggeredPayload {
  const p = payload as Partial<AlertTriggeredPayload>;
  if (typeof p?.alertId !== 'string' || typeof p?.riskScore !== 'number') {
    throw new Error(`Malformed alert.triggered payload: ${JSON.stringify(payload)}`);
  }
  return p as AlertTriggeredPayload;
}

function signPayload(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function deliverToSubscriber(
  alertId: string,
  sub: typeof webhookSubscriptions.$inferSelect,
  body: string,
): Promise<void> {
  // Ensure a tracking row exists before attempting delivery — onConflictDoNothing
  // so a retry doesn't reset attempts/status for a row that already exists.
  await db
    .insert(alertDeliveries)
    .values({ alertId, subscriptionId: sub.id })
    .onConflictDoNothing({ target: [alertDeliveries.alertId, alertDeliveries.subscriptionId] });

  const [existing] = await db
    .select()
    .from(alertDeliveries)
    .where(and(eq(alertDeliveries.alertId, alertId), eq(alertDeliveries.subscriptionId, sub.id)))
    .limit(1);

  if (!existing || existing.status === 'DELIVERED') {
    // skip if the row doesn't exist or the alert is already delivered
    return;
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (sub.secret) headers['X-Signature'] = signPayload(body, sub.secret);

    const res = await fetch(sub.url, { method: 'POST', headers, body });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await db
      .update(alertDeliveries)
      .set({ status: 'DELIVERED', deliveredAt: new Date(), attempts: existing.attempts + 1 })
      .where(eq(alertDeliveries.id, existing.id));
  } catch (err) {
    await db
      .update(alertDeliveries)
      .set({
        status: 'FAILED',
        attempts: existing.attempts + 1,
        lastError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(alertDeliveries.id, existing.id));
    throw err; // re-thrown per-subscriber, caught by allSettled below
  }
}

export async function sendAlertWebhook(rawPayload: unknown): Promise<void> {
  const alert = assertAlertTriggered(rawPayload);

  const subscriptions = await db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.active, true));

  if (subscriptions.length === 0) return;

  const body = JSON.stringify(alert);

  const results = await Promise.allSettled(
    subscriptions.map((sub) => deliverToSubscriber(alert.alertId, sub, body)),
  );

  const anyFailed = results.some((r) => r.status === 'rejected');

  // alerts.deliveredAt stays a simple "did everything succeed" summary flag —
  // alert_deliveries is the source of truth for per-subscriber status.
  if (!anyFailed) {
    await db.update(alerts).set({ deliveredAt: new Date() }).where(eq(alerts.id, alert.alertId));
  }

  if (anyFailed) {
    // Triggers redelivery — but deliverToSubscriber's DELIVERED check above
    // means only the subscribers that actually failed get retried.
    throw new Error('One or more webhook deliveries failed — see alert_deliveries for detail');
  }
}