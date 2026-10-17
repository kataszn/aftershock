// Pins the ingest poll loop's backoff behaviour: an empty cycle (nothing
// inserted) doubles the delay up to a hard cap, and any cycle that inserts an
// event snaps the cadence straight back to the base interval.
//
// The loop is driven deterministically by capturing the callbacks handed to
// setTimeout instead of running real/fake timers: `startPolling()` runs its
// first cycle immediately, and each captured callback is the next tick.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const endTimer = vi.fn();
  return {
    fetchUsgsFeed: vi.fn(),
    ingestHazardEvent: vi.fn(),
    metrics: {
      ingestCycleDuration: { startTimer: vi.fn(() => endTimer) },
      ingestEventsTotal: { inc: vi.fn() },
      ingestPollInterval: { set: vi.fn() },
    },
    logger: { info: vi.fn(), error: vi.fn() },
  };
});

vi.mock('./usgs.client', () => ({ fetchUsgsFeed: mocks.fetchUsgsFeed }));
vi.mock('@repo/db', () => ({ ingestHazardEvent: mocks.ingestHazardEvent }));
vi.mock('../telemetry', () => ({ logger: mocks.logger, metrics: mocks.metrics }));

import { runIngestCycle, startPolling } from './poll';

const BASE_POLL_MS = 60_000;
const MAX_POLL_MS = 15 * 60_000;

type ScheduledTimeout = { fn: () => void; ms: number };

/** Replaces setTimeout with a recorder so each tick can be invoked by hand. */
function captureTimeouts(): ScheduledTimeout[] {
  const scheduled: ScheduledTimeout[] = [];
  vi.spyOn(globalThis, 'setTimeout').mockImplementation(((
    fn: () => void,
    ms?: number,
  ) => {
    scheduled.push({ fn, ms: ms ?? 0 });
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof setTimeout);
  return scheduled;
}

/** Drains the microtask queue so a pending async tick chain can settle. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 25; i += 1) {
    await Promise.resolve();
  }
}

/** Runs the next scheduled tick and waits for it to settle. */
async function runScheduledTick(scheduled: ScheduledTimeout[]): Promise<void> {
  scheduled.at(-1)!.fn();
  await flushMicrotasks();
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('runIngestCycle', () => {
  it('reports fetched/inserted counts and records each event outcome', async () => {
    mocks.fetchUsgsFeed.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    mocks.ingestHazardEvent
      .mockResolvedValueOnce({ inserted: true })
      .mockResolvedValueOnce({ inserted: false });

    const result = await runIngestCycle();

    expect(result).toEqual({ fetched: 2, inserted: 1 });
    expect(mocks.metrics.ingestEventsTotal.inc).toHaveBeenCalledWith({ result: 'inserted' });
    expect(mocks.metrics.ingestEventsTotal.inc).toHaveBeenCalledWith({ result: 'duplicate' });
  });
});

describe('startPolling backoff', () => {
  it('doubles the delay per empty cycle, capped at 15 minutes', async () => {
    const scheduled = captureTimeouts();
    mocks.fetchUsgsFeed.mockResolvedValue([]);

    startPolling();
    await flushMicrotasks();

    const delays: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      delays.push(scheduled.at(-1)!.ms);
      await runScheduledTick(scheduled);
    }

    expect(delays).toEqual([
      2 * BASE_POLL_MS,
      4 * BASE_POLL_MS,
      8 * BASE_POLL_MS,
      MAX_POLL_MS,
      MAX_POLL_MS,
      MAX_POLL_MS,
    ]);
  });

  it('backs off when events are fetched but all are duplicates (nothing actually inserted)', async () => {
    const scheduled = captureTimeouts();
    mocks.fetchUsgsFeed.mockResolvedValue([{ id: 'dup' }]);
    mocks.ingestHazardEvent.mockResolvedValue({ inserted: false });

    startPolling();
    await flushMicrotasks();

    expect(scheduled.at(-1)!.ms).toBe(2 * BASE_POLL_MS);
  });

  it('resets to the base interval as soon as a cycle inserts an event', async () => {
    const scheduled = captureTimeouts();
    mocks.fetchUsgsFeed.mockResolvedValue([]);

    startPolling();
    await flushMicrotasks();
    expect(scheduled.at(-1)!.ms).toBe(2 * BASE_POLL_MS);

    mocks.fetchUsgsFeed.mockResolvedValue([{ id: 'new' }]);
    mocks.ingestHazardEvent.mockResolvedValue({ inserted: true });
    await runScheduledTick(scheduled);

    expect(scheduled.at(-1)!.ms).toBe(BASE_POLL_MS);
  });

  it('backs off when a cycle throws instead of retrying at full rate', async () => {
    const scheduled = captureTimeouts();
    mocks.fetchUsgsFeed.mockRejectedValue(new Error('feed down'));

    startPolling();
    await flushMicrotasks();

    expect(mocks.logger.error).toHaveBeenCalled();
    expect(scheduled.at(-1)!.ms).toBe(2 * BASE_POLL_MS);
  });
});
