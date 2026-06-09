CREATE TABLE IF NOT EXISTS "schema_auth"."schema_version" (
	"id" serial PRIMARY KEY NOT NULL,
	"version" varchar(50) NOT NULL,
	"applied_by" varchar(100) NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" varchar(255) NOT NULL
);
--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ALTER COLUMN "action" SET DATA TYPE varchar(120);--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" DROP COLUMN IF EXISTS "user_id";--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ADD COLUMN IF NOT EXISTS "actor_sub" uuid;--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ADD COLUMN IF NOT EXISTS "actor_email" varchar(255);--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ADD COLUMN IF NOT EXISTS "actor_role" varchar(20);--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ADD COLUMN IF NOT EXISTS "resource_type" varchar(80);--> statement-breakpoint
UPDATE "schema_auth"."audit_logs" SET "resource_type" = 'system' WHERE "resource_type" IS NULL;--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ALTER COLUMN "resource_type" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ADD COLUMN IF NOT EXISTS "resource_id" varchar(255);--> statement-breakpoint
ALTER TABLE "schema_auth"."audit_logs" ADD COLUMN IF NOT EXISTS "correlation_id" uuid;