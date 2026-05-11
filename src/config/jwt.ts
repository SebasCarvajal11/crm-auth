import { createPublicKey, createSign } from "node:crypto";
import { env } from "./env";

/** Normaliza PEM desde `.env` (líneas como `\n`). */
export const normalizePem = (raw: string) => raw.replace(/\\n/g, "\n").trim();

export const JWT_ALG = "RS256" as const;

const b64urlJson = (obj: object) =>
  Buffer.from(JSON.stringify(obj)).toString("base64url");

/**
 * Firma JWT RS256 con `kid` en el header (JWKS / rotación en gateway).
 */
export const signRs256Jwt = (
  payload: Record<string, unknown>,
  privateKeyPem: string,
  kid: string
): string => {
  const pem = normalizePem(privateKeyPem);
  const header = { alg: JWT_ALG, typ: "JWT", kid };
  const partial = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(partial);
  const signature = signer.sign(pem);
  return `${partial}.${Buffer.from(signature).toString("base64url")}`;
};

/** Documento JWKS (RFC 7517) para gateways (KrakenD, etc.). */
export const getJwksDocument = () => {
  const pem = normalizePem(env.JWT_PUBLIC_KEY);
  const key = createPublicKey(pem);
  const jwk = key.export({ format: "jwk" }) as {
    kty: string;
    n?: string;
    e?: string;
  };

  return {
    keys: [
      {
        ...jwk,
        kid: env.JWT_KID,
        use: "sig",
        alg: JWT_ALG,
      },
    ],
  };
};
