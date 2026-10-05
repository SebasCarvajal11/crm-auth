/**
 * Seed de desarrollo: crea usuarios de prueba realistas.
 * Uso: pnpm db:seed
 */
import { hash } from "bcrypt";
import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./connection";
import { identityOutbox, users } from "./schema";

const ADMIN_PASSWORD = "Admin123!";
const DEFAULT_PASSWORD = "Demo123!";

interface UserSeed {
  email: string;
  role: "admin" | "worker" | "client";
  name: string;
}

const USERS_TO_SEED: UserSeed[] = [
  { email: "admin@cima.dev", role: "admin", name: "Carlos Mendoza" },
  { email: "director@cima.dev", role: "admin", name: "Maria Elena Garcia" },
  { email: "gerente@cima.dev", role: "admin", name: "Roberto Jimenez" },
  { email: "ana.martinez@cima.dev", role: "worker", name: "Ana Martinez" },
  { email: "luis.rodriguez@cima.dev", role: "worker", name: "Luis Rodriguez" },
  { email: "sofia.herrera@cima.dev", role: "worker", name: "Sofia Herrera" },
  { email: "diego.morales@cima.dev", role: "worker", name: "Diego Morales" },
  { email: "pedro.sanchez@cima.dev", role: "worker", name: "Pedro Sanchez" },
  { email: "laura.gomez@cima.dev", role: "worker", name: "Laura Gomez" },
  { email: "miguel.torres@cima.dev", role: "worker", name: "Miguel Torres" },
  { email: "carmen.vega@cima.dev", role: "worker", name: "Carmen Vega" },
  { email: "andres.luna@cima.dev", role: "worker", name: "Andres Luna" },
  { email: "valentina.rios@cima.dev", role: "worker", name: "Valentina Rios" },
  { email: "contacto@restauranteelbuensabor.com", role: "client", name: "Restaurante El Buen Sabor" },
  { email: "marketing@tecnologiasavanzadas.co", role: "client", name: "Tecnologias Avanzadas S.A." },
  { email: "info@modabella.com", role: "client", name: "Moda Bella Boutique" },
  { email: "ventas@constructorasolida.com", role: "client", name: "Constructora Solida" },
  { email: "contacto@clinicasalud360.com", role: "client", name: "Clinica Salud 360" },
  { email: "admin@gimnasiopower.fit", role: "client", name: "Gimnasio Power Fitness" },
  { email: "info@cafeteriaaroma.com", role: "client", name: "Cafeteria Aroma" },
  { email: "gerencia@automotrizrapido.com", role: "client", name: "Automotriz Rapido" },
  { email: "contacto@academiaexito.edu", role: "client", name: "Academia Exito" },
  { email: "ventas@joyeriaplata.com", role: "client", name: "Joyeria Plata & Oro" },
  { email: "info@hotelparaiso.com", role: "client", name: "Hotel Paraiso" },
  { email: "marketing@deportesextreme.co", role: "client", name: "Deportes Extreme" },
];

async function seed() {
  console.log("Iniciando seed de usuarios...\n");

  const adminPasswordHash = await hash(ADMIN_PASSWORD, 12);
  const defaultPasswordHash = await hash(DEFAULT_PASSWORD, 12);
  const createdUsers: Array<{ email: string; subject: string; role: string }> = [];
  const failedUsers: Array<{ email: string; error: unknown }> = [];

  for (const user of USERS_TO_SEED) {
    const passwordHash = user.email === "admin@cima.dev" ? adminPasswordHash : defaultPasswordHash;
    const [firstName, ...rest] = user.name.split(" ");
    const lastName = rest.join(" ");

    try {
      const [created] = await db
        .insert(users)
        .values({
          email: user.email,
          passwordHash,
          role: user.role,
          firstName: firstName || null,
          lastName: lastName || null,
          emailVerifiedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: users.email,
          set: {
            passwordHash,
            role: user.role,
            firstName: firstName || null,
            lastName: lastName || null,
            failedLoginAttempts: 0,
            lockedUntil: null,
            forcePasswordChange: false,
          },
        })
        .returning({ email: users.email, subject: users.subject, role: users.role });

      if (created) {
        createdUsers.push(created);
        await db
          .insert(identityOutbox)
          .values({
            eventType: "auth.user.created",
            aggregateId: created.subject,
            payload: {
              eventType: "auth.user.created",
              subject: created.subject,
              email: created.email,
              role: created.role,
              firstName: firstName || undefined,
              lastName: lastName || undefined,
              isActive: true,
              version: 1,
              occurredAt: new Date().toISOString(),
            },
            status: "pending",
          })
          .catch(() => {});
        console.log(`Creado/Actualizado: ${user.email} (${user.role})`);
      } else {
        console.log(`No se pudo actualizar: ${user.email}`);
      }
    } catch (error) {
      console.error(`Error creando ${user.email}:`, error);
      failedUsers.push({ email: user.email, error });
    }
  }

  try {
    await db.execute(sql`
      INSERT INTO schema_collab.user_identity_snapshots (user_sub, email, role, first_name, last_name, created_at, updated_at)
      SELECT subject, email, role, first_name, last_name, created_at, updated_at
      FROM schema_auth.users
      ON CONFLICT (user_sub) DO UPDATE SET
        email = EXCLUDED.email,
        role = EXCLUDED.role,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        updated_at = EXCLUDED.updated_at;
    `);
    console.log("Sincronizados snapshots de identidad en schema_collab.");
  } catch {
    // Si schema_collab no existe aún en este entorno de BD, ignora.
  }

  if (failedUsers.length > 0 || createdUsers.length !== USERS_TO_SEED.length) {
    console.error(
      `\nSeed incompleto: ${createdUsers.length}/${USERS_TO_SEED.length} usuarios creados/actualizados, ${failedUsers.length} errores.`
    );
    process.exit(1);
  }

  console.log("\nResumen:");
  console.log(`  Total usuarios creados: ${createdUsers.length}`);
  console.log(`  Admins: ${createdUsers.filter((u) => u.role === "admin").length}`);
  console.log(`  Workers: ${createdUsers.filter((u) => u.role === "worker").length}`);
  console.log(`  Clients: ${createdUsers.filter((u) => u.role === "client").length}`);
  console.log(`\nClave admin de referencia: ${ADMIN_PASSWORD}`);
  console.log(`Clave general de referencia: ${DEFAULT_PASSWORD}`);
  console.log("\nSubjects de usuarios:");
  console.log(JSON.stringify(createdUsers, null, 2));

  process.exit(0);
}

seed().catch((err) => {
  console.error("Error en seed:", err);
  process.exit(1);
});
