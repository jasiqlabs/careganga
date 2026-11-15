import { Global, Inject, Injectable, Module, OnModuleDestroy } from "@nestjs/common";
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
    { provide: DATABASE, useFactory: () => new Pool({
      connectionString: readConfig().databaseUrl,
      max: 12,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      application_name: "careganga-backend"
    }) },
    DatabaseLifecycle
  ],
  exports: [DATABASE]
})
export class DatabaseModule {}
