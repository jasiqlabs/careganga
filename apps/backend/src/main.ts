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
  app.useGlobalFilters(new SafeErrorsFilter(app.get<Pool>(DATABASE)));
  app.enableCors({ origin: cfg.webOrigin, credentials: false, methods: ["GET","POST","PATCH","DELETE"] });
  await app.listen(cfg.port, "0.0.0.0");
}
void bootstrap().catch((error: unknown) => {
  // Fail closed without logging secrets or database connection strings.
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`CareGanga bootstrap failed: ${reason}\nVerify protected configuration and migrations.\n`);
  process.exitCode = 1;
});
