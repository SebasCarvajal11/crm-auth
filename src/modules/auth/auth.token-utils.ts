import { randomBytes, createHash, randomUUID } from "crypto";
import type { RefreshTokenWriter } from "./ports/auth-repositories.port";
import { env } from "../../config/env";
import { normalizePem, signRs256Jwt } from "../../config/jwt";
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_MS } from "./auth.constants";

export const generateOpaqueRefreshToken = () => randomBytes(40).toString("hex");

export const hashRefreshToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");

export const buildAccessToken = (
  subject: string,
  userId: string,
  role: "admin" | "worker" | "client",
  email: string,
  forcePasswordChange?: boolean
) => {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    sub: subject,
    userId,
    role,
    email,
    iat: now,
    exp: now + ACCESS_TOKEN_TTL_SECONDS,
  };
  if (forcePasswordChange) claims.force_password_change = true;
  if (env.JWT_ISS) claims.iss = env.JWT_ISS;
  return signRs256Jwt(claims, normalizePem(env.JWT_PRIVATE_KEY), env.JWT_KID);
};

export const issueTokenPair = async (
  repo: RefreshTokenWriter,
  userId: string,
  subject: string,
  role: "admin" | "worker" | "client",
  email: string,
  userAgent: string,
  forcePasswordChange: boolean
) => {
  const accessToken = buildAccessToken(subject, userId, role, email, forcePasswordChange);

  const rawRefreshToken = generateOpaqueRefreshToken();
  const refreshTokenHash = hashRefreshToken(rawRefreshToken);
  const familyId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await repo.saveRefreshToken({
    userId,
    tokenHash: refreshTokenHash,
    family: familyId,
    expiresAt,
    deviceInfo: userAgent,
  });

  return { accessToken, rawRefreshToken };
};
