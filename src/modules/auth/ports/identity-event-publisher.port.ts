import {
  AUTH_IDENTITY_EVENT_CONTRACT_VERSION,
  type AuthIdentityEvent,
} from "@sebascarvajal11/cima-contracts/auth-identity-events";

export type AuthIdentityProjection = {
  subject: string;
  email: string;
  role: "admin" | "worker" | "client";
  firstName?: string | null;
  lastName?: string | null;
  clientKind?: "natural" | "juridical" | null;
  companyName?: string | null;
  profession?: string | null;
};

export type AuthIdentityEventType = AuthIdentityEvent["type"];

export type IdentityEventWriter = {
  createIdentityOutboxEvent(
    type: AuthIdentityEventType,
    user: AuthIdentityProjection
  ): Promise<void>;
};

export function toAuthIdentityEvent(
  type: AuthIdentityEventType,
  user: AuthIdentityProjection
): AuthIdentityEvent {
  return {
    version: AUTH_IDENTITY_EVENT_CONTRACT_VERSION,
    type,
    userSub: user.subject,
    email: user.email,
    role: user.role,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    clientKind: user.clientKind ?? null,
    companyName: user.companyName ?? null,
    profession: user.profession ?? null,
    timestamp: new Date().toISOString(),
  };
}
