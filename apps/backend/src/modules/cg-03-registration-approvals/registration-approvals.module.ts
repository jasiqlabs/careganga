import {Module} from "@nestjs/common";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {BranchApprovalService} from "./application/branch-approval.service";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {ApprovalProposalService} from "./application/proposal.service";
import {ApprovalProposalController} from "./http/proposal.controller";
import {ApprovalDecisionController} from "./http/decision.controller";
import {ApprovalDecisionService} from "./application/decision.service";
import {ApprovalFinalizationService} from "./application/finalization.service";
import {ApprovalFinalizationController} from "./http/finalization.controller";
import {ApprovalDocumentSource} from "./application/approval-document-source.service";
import {CommittedDecisionSource} from "./application/committed-decision-source.service";
@Module({
  imports:[IdentityAccessModule,FoundationStructureModule],
  providers:[ApprovalProposalService,ApprovalDecisionService,ApprovalFinalizationService,ApprovalDocumentSource,CommittedDecisionSource,BranchApprovalService],
  controllers:[ApprovalProposalController,ApprovalDecisionController,ApprovalFinalizationController],
  exports:[ApprovalProposalService,ApprovalDocumentSource,CommittedDecisionSource,BranchApprovalService]
})
export class RegistrationApprovalsModule {}
