import { Hono } from 'hono';
import { listRecentAlerts } from '../../infra/alert.repo';
import { listDeliveriesForAlert } from '../../infra/alert-delivery.repo';

export const alertsRouter = new Hono();

alertsRouter.get('/', async (c) => {
  const alerts = await listRecentAlerts();
  return c.json({ alerts });
});

alertsRouter.get('/:alertId/deliveries', async (c) => {
  const { alertId } = c.req.param();
  const deliveries = await listDeliveriesForAlert(alertId);
  return c.json({ deliveries });
});