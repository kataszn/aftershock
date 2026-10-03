import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
const SeismicScene = lazy(() => import('./components/SeismicScene'));
import { fetchDashboard, triggerReplay } from './api/client';
import type { Alert, DashboardSnapshot } from './api/types';
import { bucketForScore } from '@repo/shared';
import { haversineDistanceKm } from './utils/geospatial';
import './App.css';

const POLL_INTERVAL_MS = 10_000;

const REPLAY_ACTIONS = [
  {
    key: 'miyazaki-m7.1',
    label: 'Replay M7.1 — Miyazaki',
    tip: 'Replays a real historical M7.1 USGS earthquake through the live pipeline to trigger risk scoring and alert delivery for the monitored portfolio.',
  },
  {
    key: 'geysers-m2.4',
    label: 'Replay M2.4 — Geysers',
    tip: 'Replays a real historical M2.4 USGS event as a low-severity control case to verify ingest and scoring without a major alert.',
  },
] as const;

function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatMagnitude(mag: string | number): string {
  return Number(mag).toFixed(1);
}

function ReplayTag({ isReplay }: { isReplay: boolean }) {
  if (!isReplay) return null;
  return <span className="tag">replayed</span>;
}

export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayStatus, setReplayStatus] = useState<string>('');
  const [activeAlert, setActiveAlert] = useState<Alert | null>(null);
  const [activeStructureId, setActiveStructureId] = useState<string | null>(null);
  // Once the user clicks a structure, stop auto-following the top alert.
  const manualSelectionRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchDashboard();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  // Surface the highest-risk alert as the "active" one driving the 3D scene.
  useEffect(() => {
    if (!snapshot || snapshot.alerts.length === 0) return;
    const top = [...snapshot.alerts].sort(
      (a, b) => Number(b.riskScore) - Number(a.riskScore),
    )[0];
    setActiveAlert(top ?? null);
  }, [snapshot]);

  // Keep the active structure in sync with the top alert (so the caption and
  // the rendered mesh never disagree), unless the user has manually selected
  // one. Falls back to the first structure when there is no alert yet.
  useEffect(() => {
    if (manualSelectionRef.current) return;
    const structures = snapshot?.structures ?? [];
    if (structures.length === 0) return;
    const match = activeAlert
      ? structures.find((s) => s.name === activeAlert.structureName)
      : undefined;
    setActiveStructureId((match ?? structures[0])?.id ?? null);
  }, [snapshot, activeAlert]);

  const handleSelectStructure = useCallback((id: string) => {
    manualSelectionRef.current = true;
    setActiveStructureId(id);
  }, []);

  const handleReplay = useCallback(
    async (key: string) => {
      setReplayStatus('Replaying…');
      try {
        const data = await triggerReplay(key);
        setReplayStatus(data.note ?? data.error ?? 'Replay submitted.');
        await load();
      } catch (err) {
        setReplayStatus(err instanceof Error ? err.message : 'Replay failed.');
      }
    },
    [load],
  );

  const summary = snapshot?.summary;
  const structures = snapshot?.structures ?? [];
  const hazards = snapshot?.hazards ?? [];
  const alerts = snapshot?.alerts ?? [];

  const criticalCount = useMemo(
    () => alerts.filter((a) => bucketForScore(Number(a.riskScore)) === 'CRITICAL').length,
    [alerts],
  );

  // The structure the 3D scene is actually rendering — the caption reads from
  // this same source so the two can never disagree.
  const activeStructure = useMemo(
    () => structures.find((s) => s.id === activeStructureId) ?? null,
    [structures, activeStructureId],
  );

  // Structures near the active hazard, sorted by true haversine distance. These
  // are the assets the current event can realistically affect, so they are the
  // ones offered as quick-select targets beside the renderer.
  const nearbyStructures = useMemo(() => {
    if (!activeAlert) return [];
    const hazardLat = Number(activeAlert.hazardLat);
    const hazardLon = Number(activeAlert.hazardLon);
    return structures
      .map((s) => ({
        structure: s,
        distanceKm: haversineDistanceKm(hazardLat, hazardLon, Number(s.lat), Number(s.lon)),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
  }, [structures, activeAlert]);

  const metricCards = [
    { label: 'Monitored assets', value: summary?.totalStructures ?? 0, foot: 'portfolio entries' },
    { label: 'Hazards ingested', value: summary?.totalHazards ?? 0, foot: 'recent USGS events' },
    { label: 'Alerts created', value: summary?.totalAlerts ?? 0, foot: 'risk breaches ≥ HIGH' },
    { label: 'Critical alerts', value: criticalCount, foot: '> 2.5 risk score' },
  ];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-block">
            <p className="eyebrow">// aftershock</p>
            <div className="brand-row">
              <div className="brand-mark" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M1 12H6L8 7L11 17L14 5L16 12H23"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1>Seismic hazard exposure monitoring</h1>
            </div>
            <p className="lede">
              Real USGS events, scored against a structure portfolio, delivered through a durable
              event-driven pipeline.
            </p>
          </div>

          <div className="topbar-actions">
            <span className="status-pill">Live pipeline</span>
            {REPLAY_ACTIONS.map((action) => (
              <button
                key={action.key}
                title={action.tip}
                onClick={() => void handleReplay(action.key)}
              >
                <span className="glyph">↻</span> {action.label}
              </button>
            ))}
          </div>
        </header>

      <section className="scene-section" aria-label="Live 3D hazard viewer">
        <div className="scene-frame">
          <Suspense fallback={<div className="scene-loading">Loading seismic viewer…</div>}>
            <SeismicScene
              structures={structures}
              hazards={hazards}
              alerts={alerts}
              activeAlert={activeAlert}
              activeStructureId={activeStructureId}
            />
          </Suspense>
        </div>
        <div className="scene-caption">
          <span className="scene-caption-title">Live 3D hazard viewer</span>
          <span className="scene-caption-meta">
            {activeStructure
              ? `Inspecting: ${activeStructure.name}${
                  activeAlert ? ` · M${formatMagnitude(activeAlert.hazardMagnitude)}` : ''
                }`
              : 'Awaiting an active alert — replay an event to populate the scene.'}
          </span>
        </div>

        {nearbyStructures.length > 0 && (
          <div className="scene-structure-picker">
            <span className="scene-picker-label">Structures near this hazard</span>
            <div className="scene-picker-list">
              {nearbyStructures.map(({ structure, distanceKm }) => (
                <button
                  type="button"
                  key={structure.id}
                  className={`scene-picker-item${
                    structure.id === activeStructureId ? ' is-active' : ''
                  }`}
                  onClick={() => handleSelectStructure(structure.id)}
                  aria-pressed={structure.id === activeStructureId}
                >
                  <span className="scene-picker-name">{structure.name}</span>
                  <span className="scene-picker-distance">{distanceKm.toFixed(1)} km</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <main className="dashboard">
        {error && <div className="error-banner">API error: {error}</div>}

        <section className="metrics-grid">
          {metricCards.map((c) => (
            <article className="metric-card" key={c.label}>
              <p className="metric-label">{c.label}</p>
              <div className="metric-value">{c.value}</div>
              <div className="metric-foot">{c.foot}</div>
            </article>
          ))}
        </section>

        <div className="layout">
          <main>
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Exposure alerts</h2>
                <span className="panel-kicker">Latest trigger events</span>
              </div>
              <div className="alert-list">
                {alerts.length === 0 ? (
                  <div className="empty-state">No alerts yet</div>
                ) : (
                  alerts.slice(0, 6).map((a) => {
                    const bucket = bucketForScore(Number(a.riskScore));
                    const delivered = Number(a.deliveredCount ?? 0);
                    const total = Number(a.totalSubscribers ?? 0);
                    const deliveryText =
                      total > 0 ? `${delivered}/${total} delivered` : 'No subscribers';
                    return (
                      <article className="alert-card" key={a.id}>
                        <div className="alert-card-header">
                          <div>
                            <h3>
                              {a.structureName}
                              <ReplayTag isReplay={a.isReplay} />
                            </h3>
                            <p className="alert-sub">
                              M{formatMagnitude(a.hazardMagnitude)} · {a.hazardPlace ?? 'Unknown'}
                            </p>
                          </div>
                          <span className={`pill bucket-${bucket}`}>{bucket}</span>
                        </div>
                        <div className="alert-metrics">
                          <div className="metric-box">
                            <label>Risk</label>
                            <strong>{Number(a.riskScore).toFixed(2)}</strong>
                          </div>
                          <div className="metric-box">
                            <label>Threshold</label>
                            <strong>{Number(a.threshold).toFixed(2)}</strong>
                          </div>
                          <div className="metric-box">
                            <label>Delivery</label>
                            <strong>{deliveryText}</strong>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
              <p className="replay-status">{replayStatus}</p>
            </section>
          </main>

          <aside className="stack">
            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Recent hazards</h2>
                <span className="panel-kicker">USGS feed</span>
              </div>
              <div className="hazard-list">
                {hazards.length === 0 ? (
                  <div className="empty-state">No hazards yet</div>
                ) : (
                  hazards.slice(0, 6).map((h) => (
                    <div className="hazard-item" key={h.id}>
                      <div className="hazard-meta">
                        <div className="hazard-mag">
                          M{formatMagnitude(h.magnitude)}
                          <ReplayTag isReplay={h.isReplay} />
                        </div>
                        <div className="hazard-location">
                          {h.locationName ?? 'Unknown location'}
                        </div>
                      </div>
                      <div className="hazard-time">{formatTime(h.occurredAt)}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2 className="panel-title">Portfolio coverage</h2>
                <span className="panel-kicker">Select to inspect</span>
              </div>
              <div className="structure-list">
                {structures.length === 0 ? (
                  <div className="empty-state">No structures loaded</div>
                ) : (
                  structures.map((s) => (
                    <div
                      key={s.id}
                      className={`structure-item${s.id === activeStructureId ? ' is-active' : ''}`}
                    >
                      <div className="structure-name">{s.name}</div>
                      <div className="structure-type">
                        {s.structureType.replace(/_/g, ' ')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>

        <footer>Built for AWS Builder Center — Zero to Shipped.</footer>
      </main>
    </div>
  );
}
