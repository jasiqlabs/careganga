import { Module } from "@nestjs/common";
import { SessionService } from "./application/session.service";
import { SessionController } from "./http/session.controller";
import { RecoveryController } from "./http/recovery.controller";
import { RecoveryService } from "./application/recovery.service";
import { RecoveryDelivery } from "./infrastructure/recovery-delivery";
import { SessionGuard } from "./http/session.guard";
import { RolesService } from "./application/roles.service";
import { RolesController } from "./http/roles.controller";
import { AccessAuditReader } from "./application/access-audit-reader";
import { AuditController } from "./http/audit.controller";

@Module({
  controllers:[SessionController,RecoveryController,RolesController,AuditController],
  providers:[SessionService,SessionGuard,RecoveryService,RecoveryDelivery,RolesService,AccessAuditReader],
  exports:[SessionService,AccessAuditReader]
})
export class IdentityAccessModule {}
