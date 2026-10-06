import { pollQueue } from '../infra/queue.client';
import { processHazardEvent } from './handlers/hazard-handler';
import { sendAlertWebhook } from '../alerts/webhook-sender';
import type { Job } from '../infra/queue.client';
import { logger, metrics } from '../telemetry';

export async function startJobConsumer(): Promise<void> {
  for await (const { job, ack } of pollQueue()) {
    const endTimer = metrics.jobDuration.startTimer({ event_type: job.eventType });
    try {
      logger.debug({ outboxId: job.outboxId, eventType: job.eventType }, 'job received');
      await processJob(job);
      await ack();
      endTimer();
      metrics.jobsProcessedTotal.inc({ event_type: job.eventType, result: 'success' });
    } catch (err) {
      // No ack on failure — SQS redelivers after visibility timeout.
      endTimer();
      metrics.jobsProcessedTotal.inc({ event_type: job.eventType, result: 'error' });
      logger.error({ err, outboxId: job.outboxId, eventType: job.eventType }, 'failed to process job');
    }
  }
}

async function processJob(job: Job): Promise<void> {
  switch (job.eventType) {
    case 'hazard.detected':
      await processHazardEvent(job.payload);
      break;
    case 'alert.triggered': {
      try {
        await sendAlertWebhook(job.payload);
      } catch (err) {
        if (err instanceof Error && err.message.startsWith('Malformed alert.triggered payload')) {
          logger.error({ err, outboxId: job.outboxId, eventType: job.eventType, payload: job.payload }, 'invalid alert.triggered payload, acknowledging message');
          return;
        }
        throw err;
      }
      break;
    }
    default:
      logger.warn({ eventType: job.eventType }, 'unrecognised job event type, skipping');
  }
}