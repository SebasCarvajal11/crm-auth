import fs from 'node:fs';
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const esc = (pem) => JSON.stringify(pem.trimEnd());
const lines = [
  'DATABASE_URL=postgres://root:rootpassword@127.0.0.1:5432/crm_database',
  'DB_SCHEMA=schema_auth',
  'REDIS_URL=redis://127.0.0.1:6379',
  'NODE_ENV=test',
  'EXPOSE_TEMP_PASSWORDS=true',
  'PORT=3000',
  'REFRESH_COOKIE_PATH=/api/v1/auth/refresh',
  'MAIL_TRANSPORT=log',
  'APP_PUBLIC_URL=http://localhost:5173',
  'EMAIL_OUTBOX_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  'ADMIN_INVITE_SECRET=test-admin-secret-123',
  `JWT_PRIVATE_KEY=${esc(privateKey)}`,
  `JWT_PUBLIC_KEY=${esc(publicKey)}`,
  'JWT_KID=mod-auth-rsa-1',
];

fs.writeFileSync('.env', lines.join('\n') + '\n');
console.log('[setup-test-env] .env successfully generated for crm-auth.');
