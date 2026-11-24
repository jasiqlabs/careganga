import "reflect-metadata";
import dns from "node:dns";
import type {Pool} from "pg";
import {DATABASE} from "./core/infrastructure/database.module";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { readConfig } from "./core/config/config";
import { SafeErrorsFilter } from "./core/http/safe-errors.filter";
import { correlateRequest } from "./core/observability/request-correlation";

// Ensure dual-stack environments resolve IPv4 addresses first to avoid ISP IPv6 DNS ENOTFOUND
try { dns.setDefaultResultOrder?.("ipv4first"); } catch {}

// Safely load environment files if present in cwd or workspace root
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(); } catch {}
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.("../../.env"); } catch {}

async function bootstrap(): Promise<void> {
  const cfg = readConfig();
  // Signature verification must see exact SendGrid webhook bytes.
  const app = await NestFactory.create(AppModule, { bodyParser: true, rawBody: true });
  app.enableShutdownHooks();
  app.use(correlateRequest);
  const pool = app.get<Pool>(DATABASE);
  app.useGlobalFilters(new SafeErrorsFilter(pool));
  const isAllowedOrigin = (origin: string | undefined): boolean => {
    if (!origin) return true;
    if (origin === cfg.webOrigin) return true;
    if (process.env.NODE_ENV !== "production") {
      try {
        const u = new URL(origin);
        if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
      } catch {}
    }
    const extra = (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);
    return extra.includes(origin);
  };

  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "x-request-id",
      "x-client-platform",
      "x-client-version",
      "x-idempotency-key",
      "Cache-Control",
      "Pragma"
    ]
  });

  // Verify database readiness before accepting incoming network traffic
  let dbReady = false;
  let lastDbError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await pool.query("SELECT 1");
      dbReady = true;
      break;
    } catch (err) {
      lastDbError = err;
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1) + Math.random() * 500));
      }
    }
  }
  if (!dbReady) {
    throw new Error(`Database readiness check failed: ${lastDbError instanceof Error ? lastDbError.message : String(lastDbError)}`);
  }

  await app.listen(cfg.port, "0.0.0.0");
}
void bootstrap().catch((error: unknown) => {
  // Fail closed without logging secrets or database connection strings.
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`CareGanga bootstrap failed: ${reason}\nVerify protected configuration and migrations.\n`);
  process.exitCode = 1;
});
