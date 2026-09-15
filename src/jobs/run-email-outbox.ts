import { decryptEmailJob } from "../email/email-outbox-crypto";
import { env } from "../config/env";
import { createUsersRepository } from "../modules/users/users.repository";
import { dispatchTransactionalEmailToMedia } from "../email/media-email-client";

export async function runEmailOutbox(batchSize = 50) {
  const repo = createUsersRepository();
  const events = await repo.listPendingEmailOutboxEvents(batchSize);
  let published = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const job = decryptEmailJob(event.payload);
      const ttl = job.type === "password_reset" ? env.PASSWORD_RESET_TTL_MS
        : job.type === "email_verify" ? env.EMAIL_VERIFY_TTL_MS : 7 * 86400_000;
      if (event.createdAt.getTime() + Math.min(ttl, 7 * 86400_000) <= Date.now()) {
        await repo.markEmailOutboxExpired(event.id);
        continue;
      }
      await dispatchTransactionalEmailToMedia(job, event);
      await repo.markEmailOutboxPublished(event.id);
      published += 1;
    } catch (error) {
      await repo.markEmailOutboxFailed(event.id, error);
      failed += 1;
    }
  }

  return { processed: events.length, published, failed };
}
