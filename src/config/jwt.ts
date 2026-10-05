import { createPrivateKey, createPublicKey, sign as cryptoSign, type KeyObject } from "node:crypto";
import { promisify } from "node:util";
import { env } from "./env";

const asyncSign = promisify(cryptoSign);

/** Normaliza PEM desde `.env` (líneas como `\n`). */
export const normalizePem = (raw: string) => raw.replace(/\\n/g, "\n").trim();

export const JWT_ALG = "RS256" as const;

const b64urlJson = (obj: object) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

const privateKeyCache = new Map<string, KeyObject>();
const publicKeyCache = new Map<string, KeyObject>();

export const getOrCreatePrivateKey = (pem: string): KeyObject => {
  const normalized = normalizePem(pem);
  const cached = privateKeyCache.get(normalized);
  if (cached) return cached;
  const key = createPrivateKey(normalized);
  privateKeyCache.set(normalized, key);
  return key;
};

export const getOrCreatePublicKey = (pem: string): KeyObject => {
  const normalized = normalizePem(pem);
  const cached = publicKeyCache.get(normalized);
  if (cached) return cached;
  const key = createPublicKey(normalized);
  publicKeyCache.set(normalized, key);
  return key;
};

/**
 * Firma JWT RS256 con `kid` en el header de forma asíncrona delegando a libuv.
 */
export const signRs256Jwt = async (
  payload: Record<string, unknown>,
  privateKeyPem: string,
  kid: string
): Promise<string> => {
  const key = getOrCreatePrivateKey(privateKeyPem);
  const header = { alg: JWT_ALG, typ: "JWT", kid };
  const partial = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signature = await asyncSign("sha256", Buffer.from(partial), key);
  return `${partial}.${signature.toString("base64url")}`;
};

/** Documento JWKS (RFC 7517) memoizado para gateways (KrakenD, etc.). */
let cachedJwks: { keys: Array<{ kty: string; kid: string; use: string; alg: string; n?: string; e?: string }> } | null = null;

export const getJwksDocument = () => {
  if (cachedJwks) return cachedJwks;
  const key = getOrCreatePublicKey(env.JWT_PUBLIC_KEY);
  const jwk = key.export({ format: "jwk" }) as {
    kty: string;
    n?: string;
    e?: string;
  };

  cachedJwks = {
    keys: [
      {
        ...jwk,
        kid: env.JWT_KID,
        use: "sig",
        alg: JWT_ALG,
      },
    ],
  };
  return cachedJwks;
};
