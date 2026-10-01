// Wraps a unit of work with idempotent execution tracking: checks the
// idempotency key first, short-circuits if already done, otherwise runs
// the callback and records PROCESSING -> SUCCESS/FAILED around it.

import { db } from '@repo/db';
import { jobExecutions } from '@repo/db/schema';
import { eq } from '@repo/db';

type RunJobExecutionArgs<T> = {
  idempotencyKey: string;
  jobType: string;
  payload: Record<string, unknown>;
  run: () => Promise<T>;
};

export async function runJobExecution<T>({
  idempotencyKey,
  jobType,
  payload,
  run,
}: RunJobExecutionArgs<T>): Promise<{ skipped: boolean; result?: T }> {
  // Check first, outside any transaction — this is a fast-path short-circuit,
  // not the source of truth for correctness. The unique constraint on
  // idempotencyKey (enforced below) is what actually prevents a duplicate
  // PROCESSING row if two workers race on the same key.
  const existing = await db
    .select({ status: jobExecutions.status })
    .from(jobExecutions)
    .where(eq(jobExecutions.idempotencyKey, idempotencyKey))
    .limit(1);

  if (existing.length > 0 && existing[0]?.status !== 'FAILED') {
    // Already succeeded, or currently being processed by another consumer.
    // Redelivered SQS messages land here as a no-op.
    return { skipped: true };
  }

  // A prior FAILED attempt is allowed to retry — insert-or-update rather
  // than a bare insert, since the row may already exist in FAILED state.
  await db
    .insert(jobExecutions)
    .values({
      idempotencyKey,
      jobType,
      status: 'PROCESSING',
      payload,
    })
    .onConflictDoUpdate({
      target: jobExecutions.idempotencyKey,
      set: { status: 'PROCESSING', startedAt: new Date(), error: null },
    });

  try {
    const result = await run();

    await db
      .update(jobExecutions)
      .set({
        status: 'SUCCESS',
        result: result as Record<string, unknown>,
        completedAt: new Date(),
      })
      .where(eq(jobExecutions.idempotencyKey, idempotencyKey));

    return { skipped: false, result };
  } catch (err) {
    await db
      .update(jobExecutions)
      .set({
        status: 'FAILED',
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      })
      .where(eq(jobExecutions.idempotencyKey, idempotencyKey));

    throw err; // re-throw so process-hazard.job.ts's catch keeps the SQS message undeleted
  }
}