import { Hono } from 'hono';
import { listRecentHazards } from '../../infra/hazard.repo';

export const hazardsRouter = new Hono();

hazardsRouter.get('/', async (c) => {
  const hazards = await listRecentHazards();
  return c.json({ hazards });
});