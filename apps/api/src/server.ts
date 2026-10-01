import { Hono } from 'hono';
import { serveStatic } from '@hono/node-server/serve-static';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { hazardsRouter } from './features/hazards/api/v1/router';
import { structuresRouter } from './features/structures/api/v1/router';
import { alertsRouter } from './features/alerts/api/v1/router';


const app = new Hono();

app.route('/api/hazards', hazardsRouter);
app.route('/api/structures', structuresRouter);
app.route('/api/alerts', alertsRouter);


const here = path.dirname(fileURLToPath(import.meta.url));
const publicRoot = path.join(here, 'public');

app.use('/*', serveStatic({ root: publicRoot }));

export default app;