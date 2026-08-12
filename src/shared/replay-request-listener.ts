import { createRedisStreamConsumerConnection, getRedisConnection } from "./redis";
import { env } from "../config/env";
import { getLogger } from "./logger";
import { createUsersRepository } from "../modules/users/users.repository";
import { identityReplayRequestedEventSchema } from "@sebascarvajal11/cima-contracts/auth-identity-events";

const logger = getLogger();

let running = false;
let readLoopPromise: Promise<void> | null = null;
let listenerRedis: NonNullable<ReturnType<typeof createRedisStreamConsumerConnection>> | undefined;

export async function startReplayRequestListener(): Promise<void> {
  const redis = createRedisStreamConsumerConnection();
  const conn = getRedisConnection();
  if (!redis || !conn) {
    logger.info(
      "[replay-request-listener] Redis no disponible; omitiendo listener de replay requests"
    );
    return;
  }

  listenerRedis = redis;

  const streamKey = env.AUTH_REQUESTS_STREAM_KEY;
  const groupName = env.AUTH_REQUESTS_CONSUMER_GROUP;

  try {
    await conn.xgroup("CREATE", streamKey, groupName, "0", "MKSTREAM");
  } catch (err: any) {
    if (!err.message?.includes("already exists")) {
      logger.error({ err }, "[replay-request-listener] XGROUP CREATE failed");
      throw err;
    }
  }

  running = true;
  logger.info(
    { consumerGroup: groupName, streamKey },
    "[replay-request-listener] Listening for identity replay requests"
  );

  readLoopPromise = readLoop(redis, streamKey, groupName);
}

export async function stopReplayRequestListener(): Promise<void> {
  running = false;
  if (readLoopPromise) {
    await Promise.race([
      readLoopPromise,
      new Promise<void>((resolve) => setTimeout(resolve, 3000)),
    ]);
  }
  await listenerRedis?.quit().catch(() => undefined);
  listenerRedis = undefined;
  readLoopPromise = null;
}

async function readLoop(redis: any, streamKey: string, groupName: string): Promise<void> {
  const consumerId = `auth-replay-listener-${process.pid}`;

  while (running) {
    try {
      const results = (await redis.xreadgroup(
        "GROUP",
        groupName,
        consumerId,
        "COUNT",
        10,
        "BLOCK",
        5000,
        "STREAMS",
        streamKey,
        ">"
      )) as any[] | null;

      if (!results || !results.length) continue;

      for (const [, messages] of results) {
        for (const [messageId, fields] of messages ?? []) {
          const fieldMap = new Map<string, string>();
          for (let i = 0; i < fields.length - 1; i += 2) {
            fieldMap.set(fields[i], fields[i + 1]);
          }

          const payloadJson = fieldMap.get("payload");
          if (!payloadJson) {
            await (getRedisConnection() || redis).xack(streamKey, groupName, messageId);
            continue;
          }

          try {
            const event = JSON.parse(payloadJson);
            const parsed = identityReplayRequestedEventSchema.safeParse(event);
            if (parsed.success) {
              logger.info(
                { correlationId: parsed.data.correlationId },
                "[replay-request-listener] Replay request received. Re-emitting active identities..."
              );
              await triggerIdentityReplay();
            } else {
              logger.warn(
                { issues: parsed.error.issues },
                "[replay-request-listener] Invalid request format received"
              );
            }
          } catch (err) {
            logger.error({ err }, "[replay-request-listener] Error processing message payload");
          }

          await (getRedisConnection() || redis).xack(streamKey, groupName, messageId);
        }
      }
    } catch (err) {
      if (!running) break;
      logger.error({ err }, "[replay-request-listener] Error in read loop");
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function triggerIdentityReplay(): Promise<void> {
  const repo = createUsersRepository();
  // Obtener todos los usuarios activos
  const { rows: users } = await repo.listUsersPaginated({
    page: 1,
    limit: 100000,
    includeDeleted: false,
  });

  if (!users.length) {
    logger.info("[replay-request-listener] No active users to replay");
    return;
  }

  logger.info(
    { count: users.length },
    "[replay-request-listener] Writing replay events to identity_outbox"
  );

  await repo.transaction(async (tx) => {
    for (const user of users) {
      await tx.createIdentityOutboxEvent("user.registered", {
        subject: user.subject,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        clientKind: user.clientKind,
        companyName: user.companyName,
        profession: user.profession,
      });
    }
  });

  logger.info("[replay-request-listener] Replay outbox events created successfully");
}
