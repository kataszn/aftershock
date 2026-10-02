import { boolean, index, jsonb, numeric,integer, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

// SeismicEvent — USGS event ID is the natural dedup key
export const seismicEvents = pgTable(
  'seismic_events',
  {
    id: text('id').primaryKey(),
    magnitude: numeric('magnitude', { precision: 4, scale: 2 }).notNull(),
    depthKm: numeric('depth_km', { precision: 8, scale: 3 }).notNull(),
    lat: numeric('lat', { precision: 9, scale: 6 }).notNull(),
    lon: numeric('lon', { precision: 9, scale: 6 }).notNull(),
    locationName: text('location_name'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    // True when this event came from a manual replay of a historical USGS
    // event rather than the live feed — lets the UI label data honestly.
    isReplay: boolean('is_replay').notNull().default(false),
  },
  (t) => [index('seismic_events_occurred_at_idx').on(t.occurredAt)],
);

// Structure — 'dam' | 'bridge' | 'unreinforced_masonry' | 'reinforced_high_rise' | 'generic_structure'
export const structures = pgTable('structures', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  name: text('name').notNull(),
  lat: numeric('lat', { precision: 9, scale: 6 }).notNull(),
  lon: numeric('lon', { precision: 9, scale: 6 }).notNull(),
  structureType: text('structure_type').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// RiskAssessment — one row per (seismic event, structure)
export const riskAssessments = pgTable(
  'risk_assessments',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    seismicEventId: text('seismic_event_id').notNull().references(() => seismicEvents.id),
    structureId: text('structure_id').notNull().references(() => structures.id),
    distanceKm: numeric('distance_km', { precision: 8, scale: 3 }).notNull(),
    riskScore: numeric('risk_score', { precision: 6, scale: 4 }).notNull(),
    alertTriggered: boolean('alert_triggered').notNull().default(false),
    computedAt: timestamp('computed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('risk_assessments_event_structure_unique').on(t.seismicEventId, t.structureId),
    index('risk_assessments_seismic_event_id_idx').on(t.seismicEventId),
  ],
);

// Outbox — transactional outbox for 'hazard.detected' | 'alert.triggered'
export const outbox = pgTable(
  'outbox',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status').notNull().default('PENDING'), // 'PENDING' | 'SENT'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    sentAt: timestamp('sent_at', { withTimezone: true }),
  },
  (t) => [index('outbox_status_created_at_idx').on(t.status, t.createdAt)],
);

// JobExecution — idempotent job tracking for 'risk.score' | 'alert.deliver'
export const jobExecutions = pgTable('job_executions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  jobType: text('job_type').notNull(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  status: text('status').notNull().default('PROCESSING'), // 'PROCESSING' | 'SUCCESS' | 'FAILED'
  payload: jsonb('payload').notNull(),
  result: jsonb('result'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// Alert — threshold breach notification for a structure
export const alerts = pgTable(
  'alerts',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    seismicEventId: text('seismic_event_id').notNull().references(() => seismicEvents.id),
    structureId: text('structure_id').notNull().references(() => structures.id),
    riskScore: numeric('risk_score', { precision: 6, scale: 4 }).notNull(),
    threshold: numeric('threshold', { precision: 6, scale: 4 }).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('alerts_created_at_idx').on(t.createdAt)],
);

// WebhookSubscription — HMAC-signed webhook targets
export const webhookSubscriptions = pgTable('webhook_subscriptions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  url: text('url').notNull(),
  secret: text('secret'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const alertDeliveries = pgTable(
  'alert_deliveries',
  {
    id: text('id').primaryKey().$defaultFn(() => createId()),
    alertId: text('alert_id').notNull().references(() => alerts.id),
    subscriptionId: text('subscription_id').notNull().references(() => webhookSubscriptions.id),
    status: text('status').notNull().default('PENDING'), // 'PENDING' | 'DELIVERED' | 'FAILED'
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('alert_deliveries_alert_subscription_unique').on(t.alertId, t.subscriptionId)],
);