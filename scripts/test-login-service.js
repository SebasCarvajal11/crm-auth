import { createLoginSessionService } from "../src/modules/auth/auth.service.login-session.js";
import { createUsersRepository } from "../src/modules/users/users.repository.js";

async function main() {
  const repo = createUsersRepository();
  const service = createLoginSessionService(repo);
  try {
    const result = await service.login({ email: "admin@cima.dev", password: "Admin123!" }, "127.0.0.1", "test");
    console.log("Login result:", result);
  } catch (err) {
    console.error("Login failed:", err);
  }
}
main().catch(console.error);
