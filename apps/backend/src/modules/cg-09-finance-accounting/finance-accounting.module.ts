import {PayrollProviderReadbackService} from "./application/payroll-provider-readback.service";
import {MembershipFeesController} from "./http/membership-fees.controller";
import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {FinanceAccountsService} from "./application/finance-accounts.service";
import {FinanceJournalPostingService} from "./application/finance-journal-posting.service";
import {FinanceJournalReversalService} from "./application/finance-journal-reversal.service";
import {FinanceAccountsController} from "./http/finance-accounts.controller";
import {FinanceVoucherDraftService} from "./application/finance-voucher-draft.service";
import {FinanceVoucherDraftController} from "./http/finance-voucher-drafts.controller";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {FinanceEvidenceSourceModule} from "../cg-19-documents-notifications/finance-evidence-source.module";
import {FinanceSourceModule} from "./finance-source.module";
import {FinanceVoucherWorkflowService} from "./application/finance-voucher-workflow.service";
import {FinanceVoucherWorkflowController} from "./http/finance-voucher-workflow.controller";
import {FinanceVoucherPaymentService} from "./application/finance-voucher-payment.service";
import {FinanceVoucherPaymentController} from "./http/finance-voucher-payment.controller";
import {FinanceVoucherDashboardService} from "./application/finance-voucher-dashboard.service";
import {FinanceVoucherDashboardController} from "./http/finance-voucher-dashboard.controller";
import {FinanceReportsService} from "./application/finance-reports.service";
import {FinanceReportsController} from "./http/finance-reports.controller";
import {FinanceBudgetService} from "./application/finance-budget.service";
import {FinanceBudgetController} from "./http/finance-budget.controller";
import {FinanceInvoiceDraftService} from "./application/finance-invoice-draft.service";
import {FinanceInvoiceDraftController} from "./http/finance-invoice-draft.controller";
import {FinanceInvoiceWorkflowService} from "./application/finance-invoice-workflow.service";
import {FinanceInvoiceCancellationService} from "./application/finance-invoice-cancellation.service";
import {FinanceInvoiceAdjustmentService} from "./application/finance-invoice-adjustment.service";
import {FinanceInvoiceWorkflowController} from "./http/finance-invoice-workflow.controller";
import {FinanceExpenseClaimService} from "./application/finance-expense-claim.service";
import {FinanceExpenseClaimController} from "./http/finance-expense-claim.controller";

/** CG-09 owns a single ledger and finance setup; never duplicates CG-01/02 masters. */
@Module({
 imports:[IdentityAccessModule,FoundationStructureModule,RegistrationApprovalsModule,DocumentsNotificationsModule,FinanceSourceModule,FinanceEvidenceSourceModule],
 providers:[PayrollProviderReadbackService,FinanceAccountsService,FinanceJournalPostingService,FinanceJournalReversalService,FinanceVoucherWorkflowService,FinanceVoucherPaymentService,FinanceVoucherDashboardService,FinanceExpenseClaimService,FinanceInvoiceDraftService,FinanceInvoiceWorkflowService,FinanceInvoiceCancellationService,FinanceInvoiceAdjustmentService,FinanceBudgetService,FinanceReportsService],
 controllers:[MembershipFeesController,FinanceAccountsController,FinanceVoucherDraftController,FinanceVoucherWorkflowController,FinanceVoucherPaymentController,FinanceVoucherDashboardController,FinanceExpenseClaimController,FinanceInvoiceDraftController,FinanceInvoiceWorkflowController,FinanceBudgetController,FinanceReportsController],
 exports:[FinanceAccountsService,FinanceReportsService]
})
export class FinanceAccountingModule {}
