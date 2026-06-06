CREATE TABLE "schema_auth"."identity_outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" varchar(80) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp DEFAULT now() NOT NULL,
	"published_at" timestamp,
	"last_error" varchar(1000),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "identity_outbox_status_available_idx" ON "schema_auth"."identity_outbox" USING btree ("status","available_at");--> statement-breakpoint
CREATE INDEX "identity_outbox_aggregate_idx" ON "schema_auth"."identity_outbox" USING btree ("aggregate_id");
