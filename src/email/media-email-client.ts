import { createHash } from "node:crypto";
import { withRetry, emailDispatchRequestSchema, emailDispatchResponseSchema } from "@sebascarvajal11/cima-contracts";
import { env } from "../config/env";
import { signRs256Jwt } from "../config/jwt";
import type { TransactionalEmailJob } from "./transactional-email.types";

export async function dispatchTransactionalEmailToMedia(
  job: TransactionalEmailJob,
  event: { id: string; createdAt: Date },
) {
  const ttl = job.type === "password_reset" ? env.PASSWORD_RESET_TTL_MS
    : job.type === "email_verify" ? env.EMAIL_VERIFY_TTL_MS : 7 * 86400_000;
  const request = emailDispatchRequestSchema.parse({
    version: 1, id: event.id,
    expiresAt: new Date(event.createdAt.getTime() + Math.min(ttl, 7 * 86400_000)).toISOString(),
    to: job.to, template: { name: job.type, variables: { token: job.token } },
  });
  const body = JSON.stringify(request);
  return withRetry(async () => {
    const now = Math.floor(Date.now() / 1000);
    const jwt = signRs256Jwt({
      iss: env.EMAIL_SERVICE_ISSUER, sub: env.EMAIL_SERVICE_ISSUER,
      aud: "crm-media:email", purpose: "email:dispatch",
      iat: now, exp: now + 60, bodyHash: createHash("sha256").update(body).digest("hex"),
    }, env.JWT_PRIVATE_KEY, env.JWT_KID);
    const response = await fetch(env.MEDIA_SERVICE_URL.replace(/\/$/, "") + "/api/v1/emails/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + jwt, "x-trace-id": event.id },
      body, signal: AbortSignal.timeout(env.MEDIA_EMAIL_TIMEOUT_MS),
    });
    if (response.status !== 202) {
      // Do not copy a peer's response into persisted errors or logs.
      throw Object.assign(new Error("Media email dispatch failed (HTTP " + response.status + ")"), { status: response.status });
    }
    return emailDispatchResponseSchema.parse(await response.json());
  }, { maxAttempts: 3, delayMs: 150 });
}
