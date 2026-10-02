# Aftershock

Real-time seismic hazard exposure monitoring for critical infrastructure. Built for the AWS Builder Center "Zero to Shipped" hackathon.

Aftershock watches the live USGS earthquake feed, matches incoming events against a portfolio of real-world structures (bridges, dams, buildings), scores each one for exposure risk based on magnitude, distance, depth, and structure type, and delivers alerts as signed webhooks through a durable, event-driven pipeline.

The infrastructure is the point of the project, not a wrapper around an AI call. Everything in this pipeline, the transactional outbox, the idempotency guarantees, the dead-letter handling, the per-subscriber delivery tracking, is real and tested, not a simplification left for later.

## Architecture

![Aftershock architecture](./arch.svg)

Two independently deployed services, deliberately not one bundled task:

- **worker** (no public ingress): polls the USGS feed, relays a transactional outbox to SQS, and consumes jobs for risk scoring and webhook delivery.
- **api** (behind an Application Load Balancer, public): a Hono service serving read endpoints, the public status page, and a judge-facing event replay endpoint.

Splitting these was a reliability decision. A bug in the worker should never be able to take down the public-facing status page.

```
USGS feed → poll loop → [seismic_events + outbox, same transaction]
                              ↓
                      outbox relay → SQS (aftershock-main)
                              ↓
                      job consumer → geo-match → risk score
                              ↓
                  [risk_assessments, idempotent] → alert?
                              ↓
                  [alerts + outbox, same transaction] → SQS → webhook sender
                              ↓
                  per-subscriber delivery tracking (alert_deliveries)
```

## How it works

1. A background poller pulls new events from the USGS feed at a fixed interval. Each new event (deduplicated on USGS's own event ID) is written to the database and a transactional outbox entry in the same transaction.
2. An outbox relay picks up pending rows and pushes them to SQS.
3. A job consumer reads the queue, filters out events below magnitude 4.0, and geo-matches the remaining ones against the structure portfolio within a magnitude-scaled search radius.
4. Each in-range structure gets a risk score. Scores at or above the HIGH threshold create an alert, written alongside another outbox entry in the same transaction.
5. The alert is relayed to SQS and delivered as a signed webhook to every active subscriber, tracked individually so a failed delivery to one subscriber never blocks or duplicates delivery to another.
6. A public status page shows monitored structures, recent hazard events, generated alerts, and delivery outcomes, and includes a replay feature to trigger the full pipeline on demand using real historical USGS events.

## Risk scoring

```
risk_score = magnitude_factor(M) × distance_decay(D, M) × depth_factor(depth) × type_multiplier(type)

magnitude_factor(M)        = 2^(M - 5)
effective_radius_km(M)     = 50 × 2^(M - 5)
distance_decay(D, M)       = exp(-D / effective_radius_km(M))
depth_factor(depth_km)     = 1 / (1 + depth_km / 50)
type_multiplier            = { dam: 1.5, unreinforced_masonry: 1.6, bridge: 1.3, generic_structure: 1.0, reinforced_high_rise: 0.8 }
```

Scores bucket into `LOW`, `MODERATE`, `HIGH`, and `CRITICAL`. This is an engineering-judgment model shaped by standard seismic attenuation principles, not a calibrated Ground Motion Prediction Equation. It produces a relative exposure score, not a measured or estimated Peak Ground Acceleration, and hasn't been validated against observed structural damage. Treat its output as a relative indicator, not an authoritative safety assessment.

## Durability mechanisms

- **Transactional outbox**: every domain write that needs to notify something downstream writes its row and an outbox row in one transaction, so a crash between the two is structurally impossible.
- **Idempotent ingest**: USGS's own event ID is the primary key, with insert-or-skip on conflict, so re-polling the feed never duplicates downstream work.
- **Two independent idempotency layers for scoring**: a job execution log (keyed by event + structure) and a separate unique constraint on the risk assessment table itself, so duplicate execution under a race is possible, but duplicate data is not.
- **Per-subscriber webhook delivery tracking**: a redelivered alert job only retries the subscribers that previously failed, not everyone.
- **Dead-letter queue**: messages that fail repeatedly (5 receives) are isolated instead of retried forever.

## Demo / event replay

Waiting for a real magnitude 4+ earthquake to land near a seeded structure during a short review window isn't realistic. The status page includes a replay feature that pushes real, previously recorded USGS events (not fabricated payloads) through the live pipeline on demand. Each replay gets a fresh identifier so concurrent replays don't collide with the deduplication logic that protects the real feed, and every replayed record is tagged `isReplay: true` and marked `REPLAYED` in the UI, so replayed and live data stay honestly distinguishable.

## Tech stack

- TypeScript, pnpm workspace monorepo
- [Hono](https://hono.dev/) for the API
- [Drizzle ORM](https://orm.drizzle.team/) + [Neon](https://neon.tech/) serverless Postgres
- AWS SQS (standard queue + DLQ), AWS Fargate (two services), Application Load Balancer
- Podman for containerization
- [Kiro](https://kiro.dev/) for AWS-side IAM policy and task definition generation during deployment

## Project structure

```
apps/
  api/      # Hono service: REST endpoints, status page, replay endpoint
  worker/   # USGS poller, outbox relay, SQS job consumer
packages/
  db/       # Drizzle schema, client, shared ingest logic
  shared/   # Event types, geo math, risk thresholds
```

## Running locally

```bash
pnpm install

# packages/db needs a real Postgres connection string (Neon or local)
cp .env.example .env

# push the schema and seed the structure portfolio
pnpm db:migrate
pnpm --filter @repo/db exec tsx src/seed.ts

# run both services
pnpm --filter @repo/worker dev
pnpm --filter @repo/api dev
```

`apps/api` serves the status page at `/status.html` once running, by default on `http://localhost:8000`.

## Testing

```bash
pnpm test
```

Unit tests cover the risk-scoring formula against real historical fixtures (a verified M7.1 near Miyazaki, Japan, and a sub-threshold M2.4 at The Geysers, California), including a hand-calculated worked example.

## Deployment

Both services deploy to AWS Fargate behind their own task definitions. A local deployment script handles the full cycle (build, push to ECR, register the task definition, force a new ECS deployment):

```bash
pnpm deploy:aws
```

See `scripts/deploy.sh` for the exact steps. Task definitions are not committed to the repo (they contain account-specific ARNs); see `api-task-def.example.json` and `worker-task-def.example.json` for sanitized templates.

## Known limitations

- The structure portfolio is a small, fixed seed set (eight real, named structures), not a real asset registry. A production version would make this a customer-managed resource.
- The risk formula is intentionally simple and legible, not a calibrated engineering standard. See [Risk scoring](#risk-scoring) above.
- The USGS feed is polled, not pushed, so there's some detection latency between a real event and the system picking it up.
- No infrastructure telemetry dashboard (live ALB/ECS/SQS metrics) is included, a deliberate scope cut, not an oversight.

## License

[MIT](./LICENSE)