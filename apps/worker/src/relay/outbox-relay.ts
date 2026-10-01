import { db } from '@repo/db';
import { outbox } from '@repo/db/schema';
import { eq, asc } from '@repo/db';
import { enqueueJob } from '../infra/queue.client';

const RELAY_INTERVAL_MS = 5_000;
const BATCH_SIZE = 20;

export async function relayPendingOutboxRows(): Promise<void> {
  const pending = await db
    .select()
    .from(outbox)
    .where(eq(outbox.status, 'PENDING'))
    .orderBy(asc(outbox.createdAt))
    .limit(BATCH_SIZE);

  for (const row of pending) {
    try {
      await enqueueJob({
        outboxId: row.id,
        eventType: row.eventType,
        payload: row.payload,
      });

      await db
        .update(outbox)
        .set({ status: 'SENT', sentAt: new Date() })
        .where(eq(outbox.id, row.id));
    } catch (err) {
      // On failure leave as PENDING — next relay tick retries. 
      // If enqueueJob succeeds but the status update fails,
      // this would re-send a message SQS already has. The queue consumer's
      // idempotency (job_executions / risk_assessments unique constraints)
      // protects against this.
      console.error(`Failed to relay outbox row ${row.id}:`, err);
    }
  }
}

export function startOutboxRelay(): void {
  relayPendingOutboxRows().catch((err) => console.error('Initial relay tick failed:', err));

  setInterval(() => {
    relayPendingOutboxRows().catch((err) => console.error('Relay tick failed:', err));
  }, RELAY_INTERVAL_MS);
}