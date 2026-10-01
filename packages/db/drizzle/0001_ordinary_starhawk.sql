CREATE TABLE "alert_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"subscription_id" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_deliveries" ADD CONSTRAINT "alert_deliveries_subscription_id_webhook_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."webhook_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_deliveries_alert_subscription_unique" ON "alert_deliveries" USING btree ("alert_id","subscription_id");