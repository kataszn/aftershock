import { serve } from '@hono/node-server';
import app, { logger } from './server';

const port = Number(process.env.PORT ?? 8000);

serve({ fetch: app.fetch, port }, (info) => {
  logger.info({ port: info.port }, 'API listening');
});