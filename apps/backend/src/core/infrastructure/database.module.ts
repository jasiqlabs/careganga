import { Global, Inject, Injectable, Logger, Module, OnModuleDestroy } from "@nestjs/common";
import { Pool } from "pg";
import { readConfig } from "../config/config";

export const DATABASE = Symbol("CAREGANGA_DATABASE");

@Injectable()
export class DatabaseLifecycle implements OnModuleDestroy {
  constructor(@Inject(DATABASE) private readonly pool: Pool) {}
  async onModuleDestroy(): Promise<void> { await this.pool.end(); }
}

@Global()
@Module({
  providers: [
    { provide: DATABASE, useFactory: () => {
      const logger = new Logger("DatabasePool");
      const pool = new Pool({
        connectionString: readConfig().databaseUrl,
        max: 12,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 15_000,
        application_name: "careganga-backend"
      });
      pool.on("error", (err: unknown) => {
        // Prevent idle client resets (e.g. Neon cloud pooler ECONNRESET) from crashing the process.
        // pg-pool automatically discards the failed idle client and lazily creates a replacement on next query.
        const code = err && typeof err === "object" && "code" in err && typeof err.code === "string"
          ? err.code : undefined;
        const failureType = err instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(err.name)
          ? err.name : "UnexpectedIdleError";
        try {
          logger.error(JSON.stringify({
            at: new Date().toISOString(),
            module: "database",
            event: "pool_idle_client_error",
            failureType,
            ...(code && /^[A-Za-z0-9_-]{1,32}$/.test(code) ? { code } : {})
          }));
        } catch {
          // Diagnostic failures must never crash the process or throw unhandled exceptions.
        }
      });
      return pool;
    } },
    DatabaseLifecycle
  ],
  exports: [DATABASE]
})
export class DatabaseModule {}
