import { createUsersRepository } from "../modules/users/users.repository";
import { publishAuthEvent } from "../shared/event-publisher";

import { traceStorage } from "../shared/logger";

export type IdentityOutboxRunResult = {
  processed: number;
  published: number;
  failed: number;
  /** Registros pendientes en outbox DB tras el tick (para gauge de métricas). */
  pending: number;
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
    const traceId = (event.payload as any)?.traceId;
    const correlationId = (event.payload as any)?.correlationId;
    const action = async () => {
      try {
        await publishAuthEvent(event.payload, { requireRedis: true });
        await repo.markIdentityOutboxPublished(event.id);
        published += 1;
      } catch (error) {
        await repo.markIdentityOutboxFailed(event.id, error);
        failed += 1;
      }
    };

    if (traceId) {
      await traceStorage.run({ traceId, correlationId }, action);
    } else {
      await action();
    }
  }

  const pending = await repo.countPendingIdentityOutboxEvents();

  return {
    processed: events.length,
    published,
    failed,
    pending,
  };
}
