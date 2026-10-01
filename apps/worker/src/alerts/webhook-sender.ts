// Consumes 'alert.triggered' jobs off the queue — delivers to every active
// subscription, HMAC-signed. 

import { db } from '@repo/db';
import { alerts, webhookSubscriptions } from '@repo/db/schema';
import { eq } from '@repo/db';
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

export async function sendAlertWebhook(rawPayload: unknown): Promise<void> {
  const alert = assertAlertTriggered(rawPayload);

  const subscriptions = await db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.active, true));

  if (subscriptions.length === 0) {
    // No subscribers is a valid state, not a failure
    // The alert still exists in the DB and on the status page.
    return;
  }

  const body = JSON.stringify(alert);

  // TODO: Implement proper error handling and retry logic for webhook deliveries.
  // context: If any delivery fails, this throws and the job is not ack'd — the
  // whole alert.triggered job redelivers, re-sending to every subscriber,
  // duplicates included. Acceptable for this week's scope (single
  // subscriber expected); worth flagging as a known simplification rather
  // than per-subscription retry tracking.
  await Promise.all(
    subscriptions.map(async (sub) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (sub.secret) {
        headers['X-Signature'] = signPayload(body, sub.secret);
      }

      const res = await fetch(sub.url, { method: 'POST', headers, body });
      if (!res.ok) {
        throw new Error(`Webhook delivery to ${sub.url} failed: ${res.status}`);
      }
    }),
  );

  await db
    .update(alerts)
    .set({ deliveredAt: new Date() })
    .where(eq(alerts.id, alert.alertId));
}