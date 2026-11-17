import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {FinanceAccountsService} from "./application/finance-accounts.service";
import {FinanceJournalPostingService} from "./application/finance-journal-posting.service";
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
import {FinanceExpenseClaimService} from "./application/finance-expense-claim.service";
import {FinanceExpenseClaimController} from "./http/finance-expense-claim.controller";

/** CG-09 owns a single ledger and finance setup; never duplicates CG-01/02 masters. */
@Module({
 imports:[IdentityAccessModule,FoundationStructureModule,RegistrationApprovalsModule,DocumentsNotificationsModule,FinanceSourceModule,FinanceEvidenceSourceModule],
 providers:[FinanceAccountsService,FinanceJournalPostingService,FinanceVoucherDraftService,FinanceVoucherWorkflowService,FinanceVoucherPaymentService,FinanceVoucherDashboardService,FinanceExpenseClaimService],
 controllers:[FinanceAccountsController,FinanceVoucherDraftController,FinanceVoucherWorkflowController,FinanceVoucherPaymentController,FinanceVoucherDashboardController,FinanceExpenseClaimController],
 exports:[FinanceAccountsService]
})
export class FinanceAccountingModule {}
