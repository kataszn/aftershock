import {
  Registry,
  Counter,
  Gauge,
  Summary,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * The full metric surface for a service. Every service gets its own registry
 * (and therefore its own `/metrics` payload) so the API and worker never
 * collide on metric names when scraped independently.
 *
 * Latency metrics are Summaries, not Histograms: the CloudWatch agent drops
 * Prometheus histogram metrics (it only supports counter, gauge, and summary),
 * so summaries are what actually reach CloudWatch. Summaries expose `_sum`,
 * `_count`, and quantile series, which is enough for p90-style alarms.
 */
export type Metrics = {
  registry: Registry;
  contentType: string;
  render: () => Promise<string>;

  // HTTP (API)
  httpRequestsTotal: Counter<'method' | 'route' | 'status'>;
  httpRequestDuration: Summary<'method' | 'route' | 'status'>;

  // Ingest (worker)
  ingestEventsTotal: Counter<'result'>;
  ingestCycleDuration: Summary<string>;

  // Outbox relay (worker)
  outboxRelayedTotal: Counter<'result'>;
  outboxPending: Gauge<string>;

  // Job consumer (worker)
  jobsProcessedTotal: Counter<'event_type' | 'result'>;
  jobDuration: Summary<'event_type'>;

  // Domain outcomes (worker)
  riskAssessmentsTotal: Counter<'bucket'>;
  alertsTriggeredTotal: Counter<'bucket'>;
  webhookDeliveriesTotal: Counter<'result'>;
  webhookDeliveryDuration: Summary<string>;
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

  const httpRequestDuration = new Summary({
    name: 'aftershock_http_request_duration_seconds',
    help: 'HTTP request latency in seconds.',
    labelNames: ['method', 'route', 'status'] as const,
    percentiles: [0.5, 0.9, 0.99],
    maxAgeSeconds: 300,
    ageBuckets: 5,
    registers: [registry],
  });

  const ingestEventsTotal = new Counter({
    name: 'aftershock_ingest_events_total',
    help: 'USGS events processed by the ingest loop, by outcome.',
    labelNames: ['result'] as const,
    registers: [registry],
  });

  const ingestCycleDuration = new Summary({
    name: 'aftershock_ingest_cycle_duration_seconds',
    help: 'Duration of a full ingest cycle in seconds.',
    percentiles: [0.5, 0.9, 0.99],
    maxAgeSeconds: 300,
    ageBuckets: 5,
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

  const jobDuration = new Summary({
    name: 'aftershock_job_duration_seconds',
    help: 'Queue job processing duration in seconds.',
    labelNames: ['event_type'] as const,
    percentiles: [0.5, 0.9, 0.99],
    maxAgeSeconds: 300,
    ageBuckets: 5,
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

  const webhookDeliveryDuration = new Summary({
    name: 'aftershock_webhook_delivery_duration_seconds',
    help: 'Webhook delivery latency in seconds.',
    percentiles: [0.5, 0.9, 0.99],
    maxAgeSeconds: 300,
    ageBuckets: 5,
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
