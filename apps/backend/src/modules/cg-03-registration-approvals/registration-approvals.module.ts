import {Module} from "@nestjs/common";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {BranchApprovalService} from "./application/branch-approval.service";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {FinanceEvidenceSourceModule} from "../cg-19-documents-notifications/finance-evidence-source.module";
import {FinanceInvoiceApprovalService} from "./application/finance-invoice-approval.service";
import {FinanceInvoiceApprovalController} from "./http/finance-invoice-approval.controller";
import {FinanceClaimApprovalService} from "./application/finance-claim-approval.service";
import {FinanceClaimApprovalController} from "./http/finance-claim-approval.controller";
import {FinanceVoucherApprovalService} from "./application/finance-voucher-approval.service";
import {FinanceVoucherApprovalController} from "./http/finance-voucher-approval.controller";
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
  imports:[IdentityAccessModule,FoundationStructureModule,FinanceSourceModule,FinanceEvidenceSourceModule],
  providers:[ApprovalProposalService,ApprovalDecisionService,ApprovalFinalizationService,ApprovalDocumentSource,CommittedDecisionSource,BranchApprovalService,FinanceVoucherApprovalService,FinanceClaimApprovalService,FinanceInvoiceApprovalService],
  controllers:[ApprovalProposalController,ApprovalDecisionController,ApprovalFinalizationController,FinanceVoucherApprovalController,FinanceClaimApprovalController,FinanceInvoiceApprovalController],
  exports:[ApprovalProposalService,ApprovalDocumentSource,CommittedDecisionSource,BranchApprovalService,FinanceVoucherApprovalService,FinanceClaimApprovalService]
})
export class RegistrationApprovalsModule {}
