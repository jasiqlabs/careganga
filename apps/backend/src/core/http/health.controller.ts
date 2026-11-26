import { Controller, Get, Inject, ServiceUnavailableException } from "@nestjs/common";
import { Pool } from "pg";
import { DATABASE } from "../infrastructure/database.module";
import { verifySchemaReadiness } from "../infrastructure/schema-readiness";

@Controller("health")
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Pool) {}
  @Get("live")
  live(): { status: string } { return { status: "alive" }; }
  @Get("ready")
  async ready(): Promise<{ status: string }> {
    try {
      await verifySchemaReadiness(this.db);
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException("Service is temporarily unavailable");
    }
  }
}
