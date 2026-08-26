import { createHash, randomBytes } from "crypto";

/**
 * Tokens delivered by email are bearer credentials. Persist only their digest so
 * a read-only database compromise cannot be used to redeem active links.
 */
export const createActionToken = (): string => randomBytes(32).toString("hex");

export const hashActionToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
