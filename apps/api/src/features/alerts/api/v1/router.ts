import { Hono } from 'hono';
import { listRecentAlerts } from '../../infra/alert.repo';

export const alertsRouter = new Hono();

alertsRouter.get('/', async (c) => {
  const alerts = await listRecentAlerts();
  return c.json({ alerts });
});