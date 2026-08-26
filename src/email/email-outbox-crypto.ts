import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { env } from "../config/env";
import type { TransactionalEmailJob } from "./transactional-email.types";

const ALGORITHM = "aes-256-gcm";

const encryptionKey = (): Buffer => {
  if (!env.EMAIL_OUTBOX_ENCRYPTION_KEY) {
    throw new Error("EMAIL_OUTBOX_ENCRYPTION_KEY is required to encrypt transactional email");
  }
  return Buffer.from(env.EMAIL_OUTBOX_ENCRYPTION_KEY, "base64");
};

export const encryptEmailJob = (job: TransactionalEmailJob): { ciphertext: string } => {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(job), "utf8"), cipher.final()]);
  return { ciphertext: Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64") };
};

export const decryptEmailJob = (payload: { ciphertext: string }): TransactionalEmailJob => {
  const data = Buffer.from(payload.ciphertext, "base64");
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8"));
};
