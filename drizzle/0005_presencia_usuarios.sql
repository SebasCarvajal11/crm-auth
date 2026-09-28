CREATE TABLE IF NOT EXISTS "schema_auth"."user_presence" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "schema_auth"."users"("id") ON DELETE CASCADE,
  "last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "user_presence_last_seen_idx" ON "schema_auth"."user_presence" USING btree ("last_seen_at");
