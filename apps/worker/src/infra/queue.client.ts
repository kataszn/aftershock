import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';

const QUEUE_URL = process.env.SQS_QUEUE_URL;
const REGION = process.env.AWS_REGION;

if (!QUEUE_URL) throw new Error('SQS_QUEUE_URL is not set');
if (!REGION) throw new Error('AWS_REGION is not set');

// Credentials are resolved by the SDK's default provider chain: env vars
// (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY) locally, or an attached IAM
// role when deployed. Region must be explicit — the SDK has no default.
const client = new SQSClient({ region: REGION });

export type Job = {
  outboxId: string;
  eventType: string;
  payload: unknown;
};

// Internal only — pairs a Job with what's needed to ack/retry it via SQS.
// process-job.ts never sees this type; queue.client.ts holds it privately.
type DeliveredJob = {
  job: Job;
  ack: () => Promise<void>;
};

export async function enqueueJob(job: Job): Promise<void> {
  await client.send(
    new SendMessageCommand({
      QueueUrl: QUEUE_URL,
      MessageBody: JSON.stringify(job),
    }),
  );
}

// Long-polling async generator — process-job.ts consumes with `for await`,
// calls ack() on success, or does nothing (letting visibility timeout
// expire) on failure. No SQS type ever leaves this file.
export async function* pollQueue(): AsyncGenerator<DeliveredJob> {
  while (true) {
    const response = await client.send(
      new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 60,
      }),
    );

    if (!response.Messages || response.Messages.length === 0) {
      continue;
    }

    for (const msg of response.Messages) {
      const job: Job = JSON.parse(msg.Body!);
      const receiptHandle = msg.ReceiptHandle!;

      yield {
        job,
        ack: () =>
          client
            .send(new DeleteMessageCommand({ QueueUrl: QUEUE_URL, ReceiptHandle: receiptHandle }))
            .then(() => undefined),
      };
    }
  }
}