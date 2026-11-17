import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FinanceVoucherProofSourceFacade} from "./application/finance-voucher-proof-source.facade";

/** CG-19 source-only evidence gate consumed by CG-03 protected review.
 * Never import the complete DocumentsNotificationsModule into CG-03,
 * which itself is an original CG-19 dependency.
 */
@Module({
 imports:[IdentityAccessModule],
 providers:[FinanceVoucherProofSourceFacade],
 exports:[FinanceVoucherProofSourceFacade]
})
export class FinanceEvidenceSourceModule{}
