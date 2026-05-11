/**
 * Seed de desarrollo — crea usuarios de prueba realistas.
 * Uso: npx tsx src/db/seed.ts
 */
import { hash } from "bcrypt";
import "dotenv/config";
import { db } from "./connection";
import { users } from "./schema";

const DEFAULT_PASSWORD = "Demo123!";

interface UserSeed {
  email: string;
  role: "admin" | "worker" | "client";
  name: string;
}

const USERS_TO_SEED: UserSeed[] = [
  // Administradores (3)
  { email: "admin@cima.dev", role: "admin", name: "Carlos Mendoza" },
  { email: "director@cima.dev", role: "admin", name: "María Elena García" },
  { email: "gerente@cima.dev", role: "admin", name: "Roberto Jiménez" },

  // Trabajadores - Diseñadores (4)
  { email: "ana.martinez@cima.dev", role: "worker", name: "Ana Martínez" },
  { email: "luis.rodriguez@cima.dev", role: "worker", name: "Luis Rodríguez" },
  { email: "sofia.herrera@cima.dev", role: "worker", name: "Sofía Herrera" },
  { email: "diego.morales@cima.dev", role: "worker", name: "Diego Morales" },

  // Trabajadores - Desarrolladores (3)
  { email: "pedro.sanchez@cima.dev", role: "worker", name: "Pedro Sánchez" },
  { email: "laura.gomez@cima.dev", role: "worker", name: "Laura Gómez" },
  { email: "miguel.torres@cima.dev", role: "worker", name: "Miguel Torres" },

  // Trabajadores - Marketing (3)
  { email: "carmen.vega@cima.dev", role: "worker", name: "Carmen Vega" },
  { email: "andres.luna@cima.dev", role: "worker", name: "Andrés Luna" },
  { email: "valentina.rios@cima.dev", role: "worker", name: "Valentina Ríos" },

  // Clientes (12)
  { email: "contacto@restauranteelbuensabor.com", role: "client", name: "Restaurante El Buen Sabor" },
  { email: "marketing@tecnologiasavanzadas.co", role: "client", name: "Tecnologías Avanzadas S.A." },
  { email: "info@modabella.com", role: "client", name: "Moda Bella Boutique" },
  { email: "ventas@constructorasolida.com", role: "client", name: "Constructora Sólida" },
  { email: "contacto@clinicasalud360.com", role: "client", name: "Clínica Salud 360" },
  { email: "admin@gimnasiopower.fit", role: "client", name: "Gimnasio Power Fitness" },
  { email: "info@cafeteriaaroma.com", role: "client", name: "Cafetería Aroma" },
  { email: "gerencia@automotrizrapido.com", role: "client", name: "Automotriz Rápido" },
  { email: "contacto@academiaexito.edu", role: "client", name: "Academia Éxito" },
  { email: "ventas@joyeriaplata.com", role: "client", name: "Joyería Plata & Oro" },
  { email: "info@hotelparaiso.com", role: "client", name: "Hotel Paraíso" },
  { email: "marketing@deportesextreme.co", role: "client", name: "Deportes Extreme" },
];

async function seed() {
  console.log("🌱 Iniciando seed de usuarios...\n");

  const passwordHash = await hash(DEFAULT_PASSWORD, 12);
  const createdUsers: Array<{ email: string; subject: string; role: string }> = [];

  for (const user of USERS_TO_SEED) {
    try {
      const [created] = await db
        .insert(users)
        .values({
          email: user.email,
          passwordHash,
          role: user.role,
          emailVerifiedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning({ email: users.email, subject: users.subject, role: users.role });

      if (created) {
        createdUsers.push(created);
        const roleIcon = user.role === "admin" ? "👑" : user.role === "worker" ? "👷" : "👤";
        console.log(`✅ ${roleIcon} ${user.name} (${user.email})`);
      } else {
        console.log(`⏭️  Ya existe: ${user.email}`);
      }
    } catch (error) {
      console.error(`❌ Error creando ${user.email}:`, error);
    }
  }

  console.log("\n📊 Resumen:");
  console.log(`   Total usuarios creados: ${createdUsers.length}`);
  console.log(`   Admins: ${createdUsers.filter((u) => u.role === "admin").length}`);
  console.log(`   Workers: ${createdUsers.filter((u) => u.role === "worker").length}`);
  console.log(`   Clients: ${createdUsers.filter((u) => u.role === "client").length}`);
  console.log(`\n🔑 Contraseña para todos: ${DEFAULT_PASSWORD}`);

  // Exportar los subjects para usar en mod-collab
  console.log("\n📋 Subjects de usuarios (para mod-collab):");
  console.log(JSON.stringify(createdUsers, null, 2));

  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Error en seed:", err);
  process.exit(1);
});
