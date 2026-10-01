import { Hono } from 'hono';
import { listStructures } from '../../infra/structure.repo';

export const structuresRouter = new Hono();

structuresRouter.get('/', async (c) => {
  const structures = await listStructures();
  return c.json({ structures });
});