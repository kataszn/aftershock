CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"seismic_event_id" text NOT NULL,
	"structure_id" text NOT NULL,
	"risk_score" numeric(6, 4) NOT NULL,
	"threshold" numeric(6, 4) NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_executions" (
	"id" text PRIMARY KEY NOT NULL,
	"job_type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'PROCESSING' NOT NULL,
	"payload" jsonb NOT NULL,
	"result" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "job_executions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "risk_assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"seismic_event_id" text NOT NULL,
	"structure_id" text NOT NULL,
	"distance_km" numeric(8, 3) NOT NULL,
	"risk_score" numeric(6, 4) NOT NULL,
	"alert_triggered" boolean DEFAULT false NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seismic_events" (
	"id" text PRIMARY KEY NOT NULL,
	"magnitude" numeric(4, 2) NOT NULL,
	"depth_km" numeric(8, 3) NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lon" numeric(9, 6) NOT NULL,
	"location_name" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structures" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"lat" numeric(9, 6) NOT NULL,
	"lon" numeric(9, 6) NOT NULL,
	"structure_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"secret" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_seismic_event_id_seismic_events_id_fk" FOREIGN KEY ("seismic_event_id") REFERENCES "public"."seismic_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_seismic_event_id_seismic_events_id_fk" FOREIGN KEY ("seismic_event_id") REFERENCES "public"."seismic_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_structure_id_structures_id_fk" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerts_created_at_idx" ON "alerts" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outbox_status_created_at_idx" ON "outbox" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "risk_assessments_event_structure_unique" ON "risk_assessments" USING btree ("seismic_event_id","structure_id");--> statement-breakpoint
CREATE INDEX "risk_assessments_seismic_event_id_idx" ON "risk_assessments" USING btree ("seismic_event_id");--> statement-breakpoint
CREATE INDEX "seismic_events_occurred_at_idx" ON "seismic_events" USING btree ("occurred_at");