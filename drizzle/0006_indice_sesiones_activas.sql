CREATE INDEX IF NOT EXISTS "refresh_tokens_live_user_expiry_idx" ON "schema_auth"."refresh_tokens" USING btree ("user_id","expires_at") WHERE "schema_auth"."refresh_tokens"."is_revoked" = false;
