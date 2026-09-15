import { decryptEmailJob } from "../email/email-outbox-crypto";
import { hashActionToken } from "../modules/auth/action-token";
import { createUsersRepository } from "../modules/users/users.repository";
import { dispatchTransactionalEmailToMedia } from "../email/media-email-client";

/**
 * Identificador estable para que reintentar un evento no duplique el correo.
 * BullMQ reserva `:` para sus claves internas, por eso el identificador usa
 * únicamente prefijos alfanuméricos y guiones.
 */
export const createEmailJobId = (job: { type: string; token: string }): string =>
  `email-${job.type}-${hashActionToken(job.token)}`;

export async function runEmailOutbox(batchSize = 50) {
  const repo = createUsersRepository();
  const events = await repo.listPendingEmailOutboxEvents(batchSize);
  let published = 0;
  let failed = 0;

  for (const event of events) {
    try {
      const job = decryptEmailJob(event.payload);
      await dispatchTransactionalEmailToMedia(job);
      await repo.markEmailOutboxPublished(event.id);
      published += 1;
    } catch (error) {
      await repo.markEmailOutboxFailed(event.id, error);
      failed += 1;
    }
  }

  return { processed: events.length, published, failed };
}
