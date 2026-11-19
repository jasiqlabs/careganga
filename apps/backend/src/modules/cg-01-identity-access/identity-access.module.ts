import { FoundationStructureIdentityFacade } from "./application/foundation-structure-identity.facade";
import { HealthNetworkIdentityFacade } from "./application/health-network-identity.facade";
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
import { AccountsService } from "./application/accounts.service";
import { AccountsController } from "./http/accounts.controller";
import { SecurityPolicyService } from "./application/security-policy.service";
import { SecurityPolicyController } from "./http/security-policy.controller";
import { ProtectedAccessOwnerService } from "./application/protected-access-owner.service";
import { CommunicationRecipientSource } from "./application/communication-recipient-source.service";
import { MobileVerificationService } from "./application/mobile-verification.service";
import { MobileVerificationController } from "./http/mobile-verification.controller";

@Module({
  controllers:[SessionController,RecoveryController,RolesController,AuditController,AccountsController,SecurityPolicyController,MobileVerificationController,PublicPatientSignupController],
  providers:[HealthNetworkIdentityFacade,FoundationStructureIdentityFacade,SessionService,SessionGuard,RecoveryService,RecoveryDelivery,RolesService,AccountsService,AccessAuditReader,SecurityPolicyService,ProtectedAccessOwnerService,CommunicationRecipientSource,MobileVerificationService,PublicPatientSignupService],
  exports:[HealthNetworkIdentityFacade,SessionService,AccessAuditReader,AccountsService,ProtectedAccessOwnerService,CommunicationRecipientSource,FoundationStructureIdentityFacade]
})
export class IdentityAccessModule {}
