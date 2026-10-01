import { db, eq } from '@repo/db';
import { alertDeliveries, webhookSubscriptions } from '@repo/db/schema';

export async function listDeliveriesForAlert(alertId: string) {
  return db
    .select({
      id: alertDeliveries.id,
      status: alertDeliveries.status,
      attempts: alertDeliveries.attempts,
      lastError: alertDeliveries.lastError,
      deliveredAt: alertDeliveries.deliveredAt,
      subscriptionUrl: webhookSubscriptions.url,
    })
    .from(alertDeliveries)
    .innerJoin(webhookSubscriptions, eq(alertDeliveries.subscriptionId, webhookSubscriptions.id))
    .where(eq(alertDeliveries.alertId, alertId));
}