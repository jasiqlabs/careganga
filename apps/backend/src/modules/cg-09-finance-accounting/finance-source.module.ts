import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FinanceExpenseClaimSourceFacade} from "./application/finance-expense-claim-source.facade";
import {FinanceVoucherSourceFacade} from "./application/finance-voucher-source.facade";
/** Source-only edge breaks CG-03/CG-19 <-> CG-09 circular dependency.
 * No finance controllers, voucher mutation or external object storage here.
 */
@Module({
 imports:[IdentityAccessModule],
 providers:[FinanceVoucherSourceFacade,FinanceExpenseClaimSourceFacade],
 exports:[FinanceVoucherSourceFacade,FinanceExpenseClaimSourceFacade]
})
export class FinanceSourceModule{}
