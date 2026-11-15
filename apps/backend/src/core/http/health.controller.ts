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
      // A fresh checkout must not report ready if an earlier security/realm
      // migration was omitted, even when the newest migration is present.
      const required = [
        "0001_cg01_identity.sql",
        "0002_cg01_totp_replay.sql",
        "0003_cg01_realm_integrity.sql",
        "0004_cg01_recovery_delivery.sql",
        "0005_cg01_permission_namespace.sql",
        "0006_cg01_role_operations.sql",
        "0007_cg01_role_command_replay_digest.sql",
        "0008_cg01_account_assignment_invitation.sql",
        "0009_cg01_invitation_resend_contact.sql",
        "0010_cg01_auth_security_policy.sql",
        "0011_cg01_immutable_access_audit.sql",
        "0012_cg01_auth_throttle_retention.sql",
        "0013_cg21_platform_configuration.sql",
        "0014_cg21_audit_recovery.sql",
        "0015_cg21_recovery_authorization.sql",
        "0201_cg02_foundation_structure.sql"
      ] as const;
      const migrations = await this.db.query<{ filename: string }>(
        "SELECT filename FROM schema_migration WHERE filename=ANY($1::text[])", [required]
      );
      const applied = new Set(migrations.rows.map(row => row.filename));
      if (required.some(filename => !applied.has(filename)))
        throw new Error("CG-01 migrations incomplete");
      return { status: "ready" };
    } catch {
      throw new ServiceUnavailableException("Service is temporarily unavailable");
    }
  }
}
