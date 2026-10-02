// Single shared logger + metrics registry for the worker process. Imported by
// every worker module so all log lines carry the same `service` field and all
// metrics land in one registry exposed by the worker's /metrics endpoint.
import { createLogger, createMetrics } from '@repo/telemetry';

export const logger = createLogger({ service: 'aftershock-worker' });
export const metrics = createMetrics('aftershock-worker');
