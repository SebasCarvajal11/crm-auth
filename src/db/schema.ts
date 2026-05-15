import {
  pgSchema,
  uuid,
  varchar,
  timestamp,
  boolean,
  jsonb,
  bigserial,
  primaryKey,
  integer,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";

export const authSchema = pgSchema("schema_auth");

export const roleEnum = authSchema.enum("role", ["admin", "worker", "client"]);
export const clientKindEnum = authSchema.enum("client_kind", ["natural", "juridical"]);
/** Identidad mínima: credenciales, rol y estado de cuenta (sin perfil CRM ni datos fiscales). */
export const users = authSchema.table("users", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  subject: uuid("subject").unique().notNull().$defaultFn(() => uuidv7()),
  email: varchar("email", { length: 255 }).unique().notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: roleEnum("role").notNull(),
  firstName: varchar("first_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }),
  clientKind: clientKindEnum("client_kind"),
  companyName: varchar("company_name", { length: 160 }),
  profession: varchar("profession", { length: 160 }),
  isActive: boolean("is_active").default(true).notNull(),
  emailVerifiedAt: timestamp("email_verified_at", { mode: "date" }),
  lastLoginAt: timestamp("last_login_at", { mode: "date" }),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until", { mode: "date" }),
  forcePasswordChange: boolean("force_password_change").default(false).notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const refreshTokens = authSchema.table("refresh_tokens", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash", { length: 255 }).notNull(),
  family: uuid("family").notNull(),
  deviceInfo: varchar("device_info", { length: 255 }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  isRevoked: boolean("is_revoked").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

/** Alta de cuenta cliente por email; datos comerciales/fiscales vivirán en mod-users / mod-crm. */
export const invitations = authSchema.table("invitations", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  email: varchar("email", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 120 }),
  lastName: varchar("last_name", { length: 120 }),
  clientKind: clientKindEnum("client_kind"),
  companyName: varchar("company_name", { length: 160 }),
  token: varchar("token", { length: 255 }).unique().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  acceptedAt: timestamp("accepted_at", { mode: "date" }),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
});

export const passwordResets = authSchema.table("password_resets", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const emailVerifications = authSchema.table("email_verifications", {
  id: uuid("id").primaryKey().$defaultFn(() => uuidv7()),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 255 }).unique().notNull(),
  expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
  isUsed: boolean("is_used").default(false).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
});

export const auditLogs = authSchema.table(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).notNull(),
    userId: uuid("user_id"),
    action: varchar("action", { length: 100 }).notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: varchar("user_agent", { length: 500 }),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.id, t.createdAt] })]
);

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  invitationsCreated: many(invitations),
  passwordResets: many(passwordResets),
  emailVerifications: many(emailVerifications),
}));

export const emailVerificationsRelations = relations(emailVerifications, ({ one }) => ({
  user: one(users, {
    fields: [emailVerifications.userId],
    references: [users.id],
  }),
}));
