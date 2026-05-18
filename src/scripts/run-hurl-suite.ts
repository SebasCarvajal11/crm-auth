import { spawn } from "node:child_process";
import { once } from "node:events";

const TEST_PORT = process.env.AUTH_TEST_PORT ?? "3100";
const BASE_URL = process.env.AUTH_TEST_BASE_URL ?? `http://127.0.0.1:${TEST_PORT}`;
const PNPM_BIN = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

const HURL_FILES = [
  "tests/01_login.hurl",
  "tests/02_me.hurl",
  "tests/03_register_worker.hurl",
  "tests/04_invite_client.hurl",
  "tests/05_refresh_logout.hurl",
  "tests/06_password_reset.hurl",
  "tests/08_rbac.hurl",
];

function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  stdio: "inherit" | "pipe" = "inherit",
) {
  return spawn(command, args, {
    env,
    stdio,
    shell: process.platform === "win32",
    windowsHide: true,
  });
}

async function waitForHealth(baseUrl: string, attempts = 30, delayMs = 1000) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Auth test server did not become healthy at ${baseUrl}/health`);
}

async function terminateProcess(child: ReturnType<typeof spawn>) {
  if (!child.pid) return;

  if (process.platform === "win32") {
    const killer = spawn("taskkill", ["/pid", String(child.pid), "/t", "/f"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await once(killer, "exit").catch(() => undefined);
    return;
  }

  child.kill("SIGTERM");
  await once(child, "exit").catch(() => undefined);
}

async function main() {
  const env = {
    ...process.env,
    NODE_ENV: "test",
    EXPOSE_TEMP_PASSWORDS: "true",
    PORT: TEST_PORT,
    REFRESH_COOKIE_PATH: "/auth/refresh",
    MAIL_TRANSPORT: process.env.MAIL_TRANSPORT ?? "log",
  };

  const server = runCommand(PNPM_BIN, ["start"], env, "pipe");
  let serverLog = "";

  server.stdout?.on("data", (chunk) => {
    serverLog += chunk.toString();
  });
  server.stderr?.on("data", (chunk) => {
    serverLog += chunk.toString();
  });

  try {
    await waitForHealth(BASE_URL);

    const reset = runCommand(PNPM_BIN, ["exec", "tsx", "src/scripts/reset-test-users.ts"], env);
    const [resetCode] = (await once(reset, "exit")) as [number | null];
    if (resetCode !== 0) {
      throw new Error(`reset-test-users failed with code ${resetCode ?? "null"}`);
    }

    const hurl = runCommand(
      "hurl",
      [
        "--test",
        "--jobs",
        "1",
        "--connect-timeout",
        "5s",
        "--max-time",
        "30s",
        "--variable",
        `base_url=${BASE_URL}`,
        ...HURL_FILES,
      ],
      env,
    );
    const [hurlCode] = (await once(hurl, "exit")) as [number | null];
    if (hurlCode !== 0) {
      throw new Error(`Hurl suite failed with code ${hurlCode ?? "null"}`);
    }
  } catch (error) {
    if (serverLog.trim()) {
      console.error(serverLog);
    }
    throw error;
  } finally {
    await terminateProcess(server);
  }
}

void main();
