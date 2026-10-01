import { Hono } from 'hono';

export const webhookTestRouter = new Hono();

webhookTestRouter.post('/receive', async (c) => {
  const signature = c.req.header('X-Signature');
  const body = await c.req.json();

  console.log('[WEBHOOK RECEIVED]:', { signature, body });

  return c.json({ received: true });
});