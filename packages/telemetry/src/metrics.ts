import {
  Registry,
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * The full metric surface for a service. Every service gets its own registry
 * (and therefore its own `/metrics` payload) so the API and worker never
 * collide on metric names when scraped independently.
 */
export type Metrics = {
  registry: Registry;
  contentType: string;
  render: () => Promise<string>;

  // HTTP (API)
  httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  httpRequestDuration: Histogram<'method' | 'route' | 'status'>;

  // Ingest (worker)
  ingestEventsTotal: Counter<'result'>;
  ingestCycleDuration: Histogram<string>;

  // Outbox relay (worker)
  outboxRelayedTotal: Counter<'result'>;
  outboxPending: Gauge<string>;

  // Job consumer (worker)
  jobsProcessedTotal: Counter<'event_type' | 'result'>;
  jobDuration: Histogram<'event_type'>;

  // Domain outcomes (worker)
  riskAssessmentsTotal: Counter<'bucket'>;
  alertsTriggeredTotal: Counter<'bucket'>;
  webhookDeliveriesTotal: Counter<'result'>;
  webhookDeliveryDuration: Histogram<string>;
};

/**
 * Creates a Prometheus registry pre-populated with Node process metrics
 * (CPU, memory, event-loop lag, GC) plus the Aftershock domain metrics.
 *
 * The default `service` label lets a single CloudWatch/Prometheus scrape
 * config distinguish API from worker series without name collisions.
 */
export function createMetrics(service: string): Metrics {
  const registry = new Registry();
  registry.setDefaultLabels({ service });

  collectDefaultMetrics({ register: registry });

  const httpRequestsTotal = new Counter({
    name: 'aftershock_http_requests_total',
    help: 'Total HTTP requests handled by the API.',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [registry],
  });

  const httpRequestDuration = new Histogram({
    name: 'aftershock_http_request_duration_seconds',
    help: 'HTTP request latency in seconds.',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [registry],
  });

  const ingestEventsTotal = new Counter({
    name: 'aftershock_ingest_events_total',
    help: 'USGS events processed by the ingest loop, by outcome.',
    labelNames: ['result'] as const,
    registers: [registry],
  });

  const ingestCycleDuration = new Histogram({
    name: 'aftershock_ingest_cycle_duration_seconds',
    help: 'Duration of a full ingest cycle in seconds.',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const outboxRelayedTotal = new Counter({
    name: 'aftershock_outbox_relayed_total',
    help: 'Outbox rows relayed to SQS, by outcome.',
    labelNames: ['result'] as const,
    registers: [registry],
  });

  const outboxPending = new Gauge({
    name: 'aftershock_outbox_pending_batch',
    help: 'Pending outbox rows observed in the most recent relay batch.',
    registers: [registry],
  });

  const jobsProcessedTotal = new Counter({
    name: 'aftershock_jobs_processed_total',
    help: 'Queue jobs processed, by event type and outcome.',
    labelNames: ['event_type', 'result'] as const,
    registers: [registry],
  });

  const jobDuration = new Histogram({
    name: 'aftershock_job_duration_seconds',
    help: 'Queue job processing duration in seconds.',
    labelNames: ['event_type'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  const riskAssessmentsTotal = new Counter({
    name: 'aftershock_risk_assessments_total',
    help: 'Risk assessments computed, by risk bucket.',
    labelNames: ['bucket'] as const,
    registers: [registry],
  });

  const alertsTriggeredTotal = new Counter({
    name: 'aftershock_alerts_triggered_total',
    help: 'Alerts triggered, by risk bucket.',
    labelNames: ['bucket'] as const,
    registers: [registry],
  });

  const webhookDeliveriesTotal = new Counter({
    name: 'aftershock_webhook_deliveries_total',
    help: 'Webhook delivery attempts, by outcome.',
    labelNames: ['result'] as const,
    registers: [registry],
  });

  const webhookDeliveryDuration = new Histogram({
    name: 'aftershock_webhook_delivery_duration_seconds',
    help: 'Webhook delivery latency in seconds.',
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [registry],
  });

  return {
    registry,
    contentType: registry.contentType,
    render: () => registry.metrics(),
    httpRequestsTotal,
    httpRequestDuration,
    ingestEventsTotal,
    ingestCycleDuration,
    outboxRelayedTotal,
    outboxPending,
    jobsProcessedTotal,
    jobDuration,
    riskAssessmentsTotal,
    alertsTriggeredTotal,
    webhookDeliveriesTotal,
    webhookDeliveryDuration,
  };
}
