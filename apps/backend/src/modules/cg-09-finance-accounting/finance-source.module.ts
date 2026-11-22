import {DonationFinancePostingFacade} from "./application/donation-finance-posting.facade";
import {MembershipFeesService} from "./application/membership-fees.service";
import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {FinanceExpenseClaimSourceFacade} from "./application/finance-expense-claim-source.facade";
import {FinanceReceiptSourceFacade} from "./application/finance-receipt-source.facade";
import {FinanceBankStatementSourceFacade} from "./application/finance-bank-statement-source.facade";
import {FinanceBudgetSourceFacade} from "./application/finance-budget-source.facade";
import {FinanceInvoiceSourceFacade} from "./application/finance-invoice-source.facade";
import {FinanceVoucherSourceFacade} from "./application/finance-voucher-source.facade";
import {FinanceJournalPostingService} from "./application/finance-journal-posting.service";
import {HealthcareFoundationPostingFacade} from "./application/healthcare-foundation-posting.facade";
import {HealthcareProviderPayoutProofFacade} from "./application/healthcare-provider-payout-proof.facade";
/** Source-only edge breaks CG-03/CG-19 <-> CG-09 circular dependency.
 * No finance controllers, voucher mutation or external object storage here.
 */
@Module({
 imports:[IdentityAccessModule,FoundationStructureModule],
 providers:[DonationFinancePostingFacade,MembershipFeesService,FinanceJournalPostingService,HealthcareProviderPayoutProofFacade,HealthcareFoundationPostingFacade,FinanceVoucherSourceFacade,FinanceExpenseClaimSourceFacade,FinanceInvoiceSourceFacade,FinanceBudgetSourceFacade,FinanceReceiptSourceFacade,FinanceBankStatementSourceFacade],
 exports:[DonationFinancePostingFacade,MembershipFeesService,HealthcareProviderPayoutProofFacade,HealthcareFoundationPostingFacade,FinanceVoucherSourceFacade,FinanceExpenseClaimSourceFacade,FinanceInvoiceSourceFacade,FinanceBudgetSourceFacade,FinanceReceiptSourceFacade,FinanceBankStatementSourceFacade]
})
export class FinanceSourceModule{}
