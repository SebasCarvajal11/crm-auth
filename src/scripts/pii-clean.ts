import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { users, invitations, identityOutbox } from "../db/schema";
import { randomUUID } from "crypto";

async function main() {
  const subject = process.argv[2];
  if (!subject) {
    console.error("Uso: pnpm tsx src/scripts/pii-clean.ts <userSubject>");
    process.exit(1);
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.subject, subject))
    .limit(1);

  if (!user) {
    console.error(`Usuario con subject ${subject} no encontrado`);
    process.exit(1);
  }

  const anonEmail = `anon-${subject}@cima.internal`;

  await db.transaction(async (tx) => {
    // 1. Anonymize user records
    await tx
      .update(users)
      .set({
        email: anonEmail,
        firstName: "Anon",
        lastName: "User",
        companyName: "Anon Corp",
        profession: "Anon",
        passwordHash: "ANONYMIZED",
        isActive: false,
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // 2. Anonymize invitations records matching user's email
    await tx
      .update(invitations)
      .set({
        email: anonEmail,
        firstName: "Anon",
        lastName: "User",
        companyName: "Anon Corp",
        profession: "Anon",
      })
      .where(eq(invitations.email, user.email));

    // 3. Create identity outbox event to notify downstream services
    const outboxEvent = {
      id: randomUUID(),
      eventType: "user.deleted",
      aggregateId: user.id,
      payload: {
        type: "user.deleted",
        version: 1,
        contractVersion: 1,
        timestamp: new Date().toISOString(),
        userSub: subject,
      },
      status: "pending",
      attempts: 0,
      availableAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await tx.insert(identityOutbox).values(outboxEvent as any);

    console.log(`[pii-clean] Usuario ${subject} anonimizado correctamente en crm-auth. Evento 'user.deleted' encolado.`);
  });

  process.exit(0);
}

main().catch((err) => {
  console.error("[pii-clean] Error in execution:", err);
  process.exit(1);
});
