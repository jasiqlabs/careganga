import "reflect-metadata";
import dns from "node:dns";
import {spawn} from "node:child_process";
import {resolve} from "node:path";
import type {Pool} from "pg";
import {DATABASE} from "./core/infrastructure/database.module";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import {provisionInitialRoot} from "./modules/cg-01-identity-access/infrastructure/bootstrap-root";
import {CmsEditorialService} from "./modules/cg-18-cms-public-content/application/cms-editorial.service";
import { readConfig } from "./core/config/config";
import { SafeErrorsFilter } from "./core/http/safe-errors.filter";
import { correlateRequest } from "./core/observability/request-correlation";
import { verifySchemaReadiness } from "./core/infrastructure/schema-readiness";

// Ensure dual-stack environments resolve IPv4 addresses first to avoid ISP IPv6 DNS ENOTFOUND
try { dns.setDefaultResultOrder?.("ipv4first"); } catch {}

// Safely load environment files if present in cwd or workspace root
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.(); } catch {}
try { (process as { loadEnvFile?: (path?: string) => void }).loadEnvFile?.("../../.env"); } catch {}

// One startup entry point also works for direct node, npm start and Docker CMD.
async function prepareDatabaseRelease():Promise<void>{
  const script=resolve(__dirname,"../../db/baseline.mjs");
  await new Promise<void>((ok,fail)=>{
    const child=spawn(process.execPath,[script,"prepare"],{env:process.env,stdio:["ignore","inherit","inherit"]});
    child.once("error",()=>fail(new Error("Database release preparation could not start.")));
    child.once("exit",(code)=>code===0?ok():fail(new Error("Database release preparation failed. See safe release diagnostics.")));
  });
}
async function bootstrap(): Promise<void> {
  const cfg = readConfig();
  // Never start Nest providers or workers until the database release is ready.
  await prepareDatabaseRelease();
  // Signature verification must see exact SendGrid webhook bytes.
  const app = await NestFactory.create(AppModule, { bodyParser: true, rawBody: true });
  app.enableShutdownHooks();
  app.use(correlateRequest);
  const pool = app.get<Pool>(DATABASE);
  app.useGlobalFilters(new SafeErrorsFilter(pool));
  app.enableCors({ origin: cfg.webOrigin, credentials: false, methods: ["GET","POST","PATCH","DELETE"] });

  // Verify database readiness before accepting incoming network traffic
  let dbReady = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await verifySchemaReadiness(pool);
      dbReady = true;
      break;
    } catch {
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt - 1) + Math.random() * 500));
      }
    }
  }
  if (!dbReady) {
    await app.close();
    throw new Error("Database schema is unavailable or incompatible. Verify database setup and release version.");
  }

  // Existing protected root credentials are used only for the first account.
  // Never fabricate a password or reset an existing account.
  try {
    const root=await provisionInitialRoot(pool,"startup");
    if(root==="created")console.log("Protected initial administrator provisioned.");
    await app.get(CmsEditorialService).initializeReleaseBaseline();
  }
  catch { await app.close(); throw new Error("Initial application setup failed. Verify protected administrator configuration, bundled assets and database permissions."); }
  await app.listen(cfg.port, "0.0.0.0");
}
void bootstrap().catch((error: unknown) => {
  // Fail closed without logging secrets or database connection strings.
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`CareGanga bootstrap failed: ${reason}\nVerify protected configuration and migrations.\n`);
  process.exitCode = 1;
});
