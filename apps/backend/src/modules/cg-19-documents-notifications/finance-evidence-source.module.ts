import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FinanceClaimBillSourceFacade} from "./application/finance-claim-bill-source.facade";
import {FinanceVoucherProofSourceFacade} from "./application/finance-voucher-proof-source.facade";
import {FinanceBankStatementProofFacade} from "./application/finance-bank-statement-proof.facade";

/** CG-19 source-only evidence gate consumed by CG-03 protected review.
 * Never import the complete DocumentsNotificationsModule into CG-03,
 * which itself is an original CG-19 dependency.
 */
@Module({
 imports:[IdentityAccessModule],
 providers:[FinanceVoucherProofSourceFacade,FinanceClaimBillSourceFacade,FinanceBankStatementProofFacade],
 exports:[FinanceVoucherProofSourceFacade,FinanceClaimBillSourceFacade,FinanceBankStatementProofFacade]
})
export class FinanceEvidenceSourceModule{}
