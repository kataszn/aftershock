import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from '@hono/node-server/serve-static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import {
  createLogger,
  createMetrics,
  requestLogger,
  metricsMiddleware,
  type TelemetryVariables,
} from '@repo/telemetry';
import { hazardsRouter } from './features/hazards/api/v1/router';
import { structuresRouter } from './features/structures/api/v1/router';
import { alertsRouter } from './features/alerts/api/v1/router';
import { webhookTestRouter } from './features/webhooks/api/v1/router';
import { replayRouter } from './features/replay/api/v1/router';
import { dashboardRouter } from './features/dashboard/api/v1/router';

export const logger = createLogger({ service: 'aftershock-api' });
export const metrics = createMetrics('aftershock-api');

const app = new Hono<{ Variables: TelemetryVariables }>();

// Telemetry first so every request (including errors and 404s) is logged and
// measured. requestLogger attaches a child logger at c.get('log').
app.use('*', requestLogger(logger));
app.use('*', metricsMiddleware(metrics));

// The standalone web app (apps/web) runs on a different origin than the API,
// so the browser needs CORS on the API routes. Restrict to known origins in
// production via CORS_ORIGINS (comma-separated); default to permissive in dev.
const corsOrigins = process.env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
app.use(
  '/api/*',
  cors({
    origin: corsOrigins && corsOrigins.length > 0 ? corsOrigins : '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
);

app.get('/health', (c) => c.text('ok'));

// Prometheus exposition endpoint. CloudWatch can ingest this via the
// CloudWatch agent's Prometheus scrape config (ECS service discovery or a
// sidecar), or an ADOT collector can remote-write it.
app.get('/metrics', async (c) => {
  return c.body(await metrics.render(), 200, { 'Content-Type': metrics.contentType });
});

// Root serves the status dashboard.
app.get('/', (c) => c.redirect('/status.html'));

app.route('/api/dashboard', dashboardRouter);
app.route('/api/hazards', hazardsRouter);
app.route('/api/structures', structuresRouter);
app.route('/api/alerts', alertsRouter);
app.route('/api/webhooks', webhookTestRouter);
app.route('/api/replay', replayRouter);

// Resolve the static root in both dev (tsx, src/) and bundled (dist/) modes.
const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot =
  fs.existsSync(path.join(here, 'public'))
    ? path.join(here, 'public')
    : path.join(here, '../src/public');

app.use('/*', serveStatic({ root: publicRoot }));

export default app;