import {Module} from "@nestjs/common";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {BranchApprovalService} from "./application/branch-approval.service";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {CmsSourceModule} from "../cg-18-cms-public-content/cms-source.module";
import {HealthSourceModule} from "../cg-14-healthcare-network/health-source.module";
import {HealthVerificationApprovalService} from "./application/health-verification-approval.service";
import {HealthCenterContentApprovalService} from "./application/health-center-content-approval.service";
import {HealthCenterContentApprovalController} from "./http/health-center-content-approval.controller";
import {HealthErpGrantApprovalService} from "./application/health-erp-grant-approval.service";
import {HealthErpGrantApprovalController} from "./http/health-erp-grant-approval.controller";
import {DoctorLeaveSourceModule} from "../cg-15-patients-appointments/doctor-leave-source.module";
import {DoctorLeaveApprovalService} from "./application/doctor-leave-approval.service";
import {DoctorLeaveApprovalController} from "./http/doctor-leave-approval.controller";
import {HealthVerificationApprovalController} from "./http/health-verification-approval.controller";
import {CmsPublicationApprovalService} from "./application/cms-publication-approval.service";
import {CmsPublicationApprovalController} from "./http/cms-publication-approval.controller";
import {FinanceEvidenceSourceModule} from "../cg-19-documents-notifications/finance-evidence-source.module";
import {FinanceBudgetApprovalService} from "./application/finance-budget-approval.service";
import {FinanceBudgetApprovalController} from "./http/finance-budget-approval.controller";
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
  imports:[IdentityAccessModule,FoundationStructureModule,FinanceSourceModule,FinanceEvidenceSourceModule,CmsSourceModule,HealthSourceModule,DoctorLeaveSourceModule],
  providers:[DoctorLeaveApprovalService,HealthErpGrantApprovalService,HealthVerificationApprovalService,HealthCenterContentApprovalService,ApprovalProposalService,ApprovalDecisionService,ApprovalFinalizationService,ApprovalDocumentSource,CommittedDecisionSource,BranchApprovalService,FinanceVoucherApprovalService,FinanceClaimApprovalService,FinanceInvoiceApprovalService,FinanceBudgetApprovalService,CmsPublicationApprovalService],
  controllers:[DoctorLeaveApprovalController,HealthErpGrantApprovalController,HealthVerificationApprovalController,HealthCenterContentApprovalController,ApprovalProposalController,ApprovalDecisionController,ApprovalFinalizationController,FinanceVoucherApprovalController,FinanceClaimApprovalController,FinanceInvoiceApprovalController,FinanceBudgetApprovalController,CmsPublicationApprovalController],
  exports:[DoctorLeaveApprovalService,HealthErpGrantApprovalService,HealthVerificationApprovalService,HealthCenterContentApprovalService,ApprovalProposalService,ApprovalDocumentSource,CommittedDecisionSource,BranchApprovalService,FinanceVoucherApprovalService,FinanceClaimApprovalService,FinanceInvoiceApprovalService,FinanceBudgetApprovalService,CmsPublicationApprovalService]
})
export class RegistrationApprovalsModule {}
