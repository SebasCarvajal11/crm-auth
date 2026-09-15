import type { EmailTemplateName } from "@sebascarvajal11/cima-contracts";
export type TransactionalEmailJob = { type: EmailTemplateName; to: string; token: string };
