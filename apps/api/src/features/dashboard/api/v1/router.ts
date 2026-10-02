import { Hono } from 'hono';
import { getDashboardSnapshot } from '../../infra/dashboard.repo';

export const dashboardRouter = new Hono();

dashboardRouter.get('/', async (c) => {
  const snapshot = await getDashboardSnapshot();
  return c.json(snapshot);
});