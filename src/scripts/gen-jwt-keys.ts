/**
 * Genera par RSA (PKCS#8 + SPKI PEM) para JWT RS256.
 * Uso: npx tsx src/scripts/gen-jwt-keys.ts
 */
import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

const esc = (pem: string) => JSON.stringify(pem.trimEnd());

console.log(`
# Copiar en .env (una sola línea con \\n entre líneas del PEM):

JWT_PRIVATE_KEY=${esc(privateKey)}
JWT_PUBLIC_KEY=${esc(publicKey)}
JWT_KID=mod-auth-rsa-1

# Opcional — recomendado en producción para validación en gateway:
# JWT_ISS=https://auth.tu-dominio.example
`);
