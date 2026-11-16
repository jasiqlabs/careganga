import { Module } from "@nestjs/common";
import { FoundationStructureIdentityFacade } from "./application/foundation-structure-identity.facade";
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
import { AccountsService } from "./application/accounts.service";
import { AccountsController } from "./http/accounts.controller";
import { InvitationEnrollmentService } from "./application/invitation-enrollment.service";
import { InvitationController } from "./http/invitation.controller";
import { SecurityPolicyService } from "./application/security-policy.service";
import { SecurityPolicyController } from "./http/security-policy.controller";
import { ProtectedAccessOwnerService } from "./application/protected-access-owner.service";

@Module({
  controllers:[SessionController,RecoveryController,InvitationController,RolesController,AuditController,AccountsController,SecurityPolicyController],
  providers:[FoundationStructureIdentityFacade,SessionService,SessionGuard,RecoveryService,InvitationEnrollmentService,RecoveryDelivery,RolesService,AccountsService,AccessAuditReader,SecurityPolicyService,ProtectedAccessOwnerService],
  exports:[SessionService,AccessAuditReader,AccountsService,ProtectedAccessOwnerService,FoundationStructureIdentityFacade]
})
export class IdentityAccessModule {}
