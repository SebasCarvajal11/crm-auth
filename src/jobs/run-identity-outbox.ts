import { createUsersRepository } from "../modules/users/users.repository";
import { publishAuthEvent } from "../shared/event-publisher";

export type IdentityOutboxRunResult = {
  processed: number;
  published: number;
  failed: number;
};

export async function runIdentityOutbox(
  opts: { batchSize?: number } = {}
): Promise<IdentityOutboxRunResult> {
  const repo = createUsersRepository();
  const batchSize = opts.batchSize ?? 50;
  const events = await repo.listPendingIdentityOutboxEvents(batchSize);

  let published = 0;
  let failed = 0;

  for (const event of events) {
    try {
      await publishAuthEvent(event.payload, { requireRedis: true });
      await repo.markIdentityOutboxPublished(event.id);
      published += 1;
    } catch (error) {
      await repo.markIdentityOutboxFailed(event.id, error);
      failed += 1;
    }
  }

  return {
    processed: events.length,
    published,
    failed,
  };
}
