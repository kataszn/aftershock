import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { hazardsRouter } from './features/hazards/api/v1/router';
import { structuresRouter } from './features/structures/api/v1/router';
import { alertsRouter } from './features/alerts/api/v1/router';
import { webhookTestRouter } from './features/webhooks/api/v1/router';
import { replayRouter } from './features/replay/api/v1/router';
import { dashboardRouter } from './features/dashboard/api/v1/router';

const app = new Hono();

app.get('/health', (c) => c.text('ok'));

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