import { env } from "../config/env";
import { createUsersRepository } from "../modules/users/users.repository";
import type { TokenCleanupCounts } from "../modules/users/repository/token-cleanup.repository";

export async function runTokenCleanup(): Promise<TokenCleanupCounts> {
  const repo = createUsersRepository();
  return repo.purgeStaleAuthArtifacts(env.TOKEN_CLEANUP_RETENTION_DAYS);
}
