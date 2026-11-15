import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { readConfig } from "./core/config/config";
import { SafeErrorsFilter } from "./core/http/safe-errors.filter";
import { correlateRequest } from "./core/observability/request-correlation";

async function bootstrap(): Promise<void> {
  const cfg = readConfig();
  const app = await NestFactory.create(AppModule, { bodyParser: true });
  app.enableShutdownHooks();
  app.use(correlateRequest);
  app.useGlobalFilters(new SafeErrorsFilter());
  app.enableCors({ origin: cfg.webOrigin, credentials: false, methods: ["GET","POST","PATCH","DELETE"] });
  await app.listen(cfg.port, "0.0.0.0");
}
void bootstrap().catch(() => {
  // Fail closed without logging secrets or database connection strings.
  process.stderr.write("CareGanga bootstrap failed; verify protected configuration and migrations.\n");
  process.exitCode = 1;
});
