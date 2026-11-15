import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE } from "../infrastructure/database.module";

@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Pool) {}
  @Get("live")
  live(): { status: string } { return { status: "alive" }; }
  @Get("ready")
  async ready(): Promise<{ status: string }> {
    try {
      const result = await this.db.query<{ reg: string | null }>(
        "SELECT to_regclass('public.account')::text AS reg"
      );
      if (!result.rows[0]?.reg) throw new Error("Migration missing");
      const migrations = await this.db.query<{ filename: string }>(
        "SELECT filename FROM schema_migration WHERE filename = $1", ["0009_cg01_invitation_resend_contact.sql"]
      );
      if (!migrations.rowCount) throw new Error("CG-01 migrations incomplete");
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException("Service is temporarily unavailable");
    }
  }
}
