import { pollQueue } from '../infra/queue.client';
import { processHazardEvent } from './handlers/hazard-handler';
import { sendAlertWebhook } from '../alerts/webhook-sender';
import type { Job } from '../infra/queue.client';

export async function startJobConsumer(): Promise<void> {
  for await (const { job, ack } of pollQueue()) {
    try {
      console.log('from queue:', job);
      await processJob(job);
      await ack();
    } catch (err) {
      // No ack on failure — SQS redelivers after visibility timeout.
      console.error(`Failed to process job (outboxId: ${job.outboxId}):`, err);
    }
  }
}

async function processJob(job: Job): Promise<void> {
  switch (job.eventType) {
    case 'hazard.detected':
      await processHazardEvent(job.payload);
      break;
    case 'alert.triggered':
      await sendAlertWebhook(job.payload);
      break;
    default:
      console.warn(`Unrecognised job event type, skipping: ${job.eventType}`);
  }
}