// Load the root .env before any other module reads process.env. This must be
// the first import so it evaluates before queue.client.ts captures SQS_QUEUE_URL
// and AWS_REGION at module load time.
import './config/env';
import { logger } from './telemetry';
import { startMetricsServer } from './metrics-server';
import { startPolling } from './ingest/poll';
import { startOutboxRelay } from './relay/outbox-relay';
import { startJobConsumer } from './jobs/process.job';

logger.info('worker starting');

startMetricsServer();  // Prometheus /metrics + /health for in-cluster scraping
startPolling();        // USGS -> ingestHazardEvent() -> DB + outbox, in-process
startOutboxRelay();    // outbox PENDING -> SQS
startJobConsumer();    // SQS -> process-hazard.job -> risk_assessments/job_executions -> maybe alert