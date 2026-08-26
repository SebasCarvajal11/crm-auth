CREATE TABLE "schema_auth"."email_outbox" (
  "id" uuid PRIMARY KEY NOT NULL,
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
CREATE INDEX "email_outbox_status_available_idx" ON "schema_auth"."email_outbox" USING btree ("status","available_at");
