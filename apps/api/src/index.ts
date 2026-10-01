import { serve } from '@hono/node-server';
import app from './server';

const port = Number(process.env.PORT ?? 8000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API listening on port ${info.port}`);
});