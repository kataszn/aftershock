import { Hono } from 'hono';
import type { TelemetryVariables } from '@repo/telemetry';

export const webhookTestRouter = new Hono<{ Variables: TelemetryVariables }>();

webhookTestRouter.post('/receive', async (c) => {
  const signature = c.req.header('X-Signature');
  const body = await c.req.json();

  c.get('log').info({ signature, body }, 'webhook received');

  return c.json({ received: true });
});