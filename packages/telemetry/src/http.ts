import type { MiddlewareHandler } from 'hono';
import type { Logger } from 'pino';
import type { Metrics } from './metrics';

/** Hono context variables populated by the telemetry middleware. */
export type TelemetryVariables = {
  requestId: string;
  log: Logger;
};

/**
 * Paths excluded from the access log in production. Scrapers and load-balancer
 * health probes hit these constantly, so logging them adds noise without
 * signal. In development nothing is skipped — you want to see every request.
 */
const PROD_SKIP_PATHS = new Set(['/metrics', '/health']);

/**
 * Assigns a request id, attaches a child logger to the context (`c.get('log')`),
 * and emits one structured access log line per request with latency.
 *
 * In production, health-check and metrics-scrape paths are skipped to keep the
 * log stream signal-dense; in development every request is logged.
 */
export function requestLogger(logger: Logger): MiddlewareHandler<{
  Variables: TelemetryVariables;
}> {
  const isProd = process.env.NODE_ENV === 'production';

  return async (c, next) => {
    const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
    const log = logger.child({ requestId });
    c.set('requestId', requestId);
    c.set('log', log);

    const start = performance.now();
    await next();
    const durationMs = Math.round((performance.now() - start) * 100) / 100;

    if (isProd && PROD_SKIP_PATHS.has(c.req.path)) {
      return;
    }

    log.info(
      {
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        durationMs,
      },
      'request',
    );
  };
}

/**
 * Records request count and latency into the Prometheus registry. Uses the
 * matched route pattern (`c.req.routePath`) rather than the raw path so
 * parameterised routes don't explode label cardinality.
 */
export function metricsMiddleware(metrics: Metrics): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now();
    await next();
    const durationSec = (performance.now() - start) / 1000;

    const labels = {
      method: c.req.method,
      route: c.req.routePath || c.req.path,
      status: String(c.res.status),
    };

    metrics.httpRequestsTotal.inc(labels);
    metrics.httpRequestDuration.observe(labels, durationSec);
  };
}
