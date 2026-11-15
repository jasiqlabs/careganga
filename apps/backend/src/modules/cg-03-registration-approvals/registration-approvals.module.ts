import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {ApprovalProposalService} from "./application/proposal.service";
import {ApprovalProposalController} from "./http/proposal.controller";
import {ApprovalDecisionController} from "./http/decision.controller";
import {ApprovalDecisionService} from "./application/decision.service";
import {ApprovalFinalizationService} from "./application/finalization.service";
import {ApprovalFinalizationController} from "./http/finalization.controller";
@Module({
  imports:[IdentityAccessModule],
  providers:[ApprovalProposalService,ApprovalDecisionService,ApprovalFinalizationService],
  controllers:[ApprovalProposalController,ApprovalDecisionController,ApprovalFinalizationController],
  exports:[ApprovalProposalService]
})
export class RegistrationApprovalsModule {}
