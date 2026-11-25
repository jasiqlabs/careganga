import { spawn } from "node:child_process";
import { resolve } from "node:path";

export interface BootstrapProcessOptions {
  databaseUrl?: string;
  confirmFlag?: boolean;
  name?: string;
  mobile?: string;
  email?: string | null;
  password?: string;
  extraArgs?: string[];
  timeoutMs?: number;
}

export interface BootstrapProcessResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Spawns the production Super Admin bootstrap script in an isolated subprocess.
 * Validates real CLI argument parsing, transaction isolation, and row locking.
 */
export async function runBootstrapSubprocess(
  options: BootstrapProcessOptions
): Promise<BootstrapProcessResult> {
  const scriptPath = resolve(
    __dirname,
    "../src/modules/cg-01-identity-access/infrastructure/bootstrap-root.ts"
  );
  const tsxCli = require.resolve("tsx/cli");

  const args: string[] = [tsxCli, scriptPath];

  if (options.confirmFlag !== false) {
    args.push("--confirm-one-time-root");
  }

  if (options.extraArgs && options.extraArgs.length > 0) {
    args.push(...options.extraArgs);
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
  };

  // Explicitly control environment variables for isolation
  if (options.databaseUrl !== undefined) {
    env.DATABASE_MIGRATION_URL = options.databaseUrl;
  } else {
    env.DATABASE_MIGRATION_URL = "";
  }

  if (options.name !== undefined) {
    env.CAREGANGA_ROOT_NAME = options.name;
  } else {
    delete env.CAREGANGA_ROOT_NAME;
  }

  if (options.mobile !== undefined) {
    env.CAREGANGA_ROOT_MOBILE = options.mobile;
  } else {
    delete env.CAREGANGA_ROOT_MOBILE;
  }

  if (options.email !== undefined && options.email !== null) {
    env.CAREGANGA_ROOT_EMAIL = options.email;
  } else {
    delete env.CAREGANGA_ROOT_EMAIL;
  }

  if (options.password !== undefined) {
    env.CAREGANGA_ROOT_PASSWORD = options.password;
  } else {
    delete env.CAREGANGA_ROOT_PASSWORD;
  }

  const startTime = Date.now();

  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      cwd: resolve(__dirname, ".."),
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });

    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Bootstrap subprocess timed out after ${options.timeoutMs ?? 15000}ms`));
    }, options.timeoutMs ?? 15000);

    child.on("close", (code) => {
      clearTimeout(timer);
      const durationMs = Date.now() - startTime;
      resolveResult({
        exitCode: code,
        stdout,
        stderr,
        durationMs,
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
