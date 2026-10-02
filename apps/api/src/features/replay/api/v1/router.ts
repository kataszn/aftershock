import { Hono } from 'hono';
import { ingestHazardEvent } from '@repo/db';
import { HISTORICAL_EVENTS, type HistoricalEventKey } from '@repo/shared';

export const replayRouter = new Hono();

replayRouter.post('/:eventKey', async (c) => {
  const eventKey = c.req.param('eventKey') as HistoricalEventKey;
  const template = HISTORICAL_EVENTS[eventKey];

  if (!template) {
    return c.json({ error: `Unknown event key. Valid: ${Object.keys(HISTORICAL_EVENTS).join(', ')}` }, 400);
  }

  // Each replay gets a fresh id — the dedup key exists to protect the real
  // USGS feed from reprocessing the same live event twice, not to limit how
  // many times a judge can re-run the demo. Real event data (magnitude,
  // location, depth, true occurredAt) is untouched; only the identity
  // of this *replay instance* is new.
  const replayEvent = {
    ...template,
    id: `${template.id}-replay-${Date.now()}`,
    isReplay: true,
  };

  const result = await ingestHazardEvent(replayEvent);

  return c.json({
    ...result,
    event: { id: replayEvent.id, magnitude: template.magnitude, place: template.place },
    note: 'Real historical USGS event replayed into the live pipeline — new run, independent of any prior replay.',
  });
});