import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {FinanceAccountsService} from "./application/finance-accounts.service";
import {FinanceJournalPostingService} from "./application/finance-journal-posting.service";
import {FinanceAccountsController} from "./http/finance-accounts.controller";
import {FinanceVoucherDraftService} from "./application/finance-voucher-draft.service";
import {FinanceVoucherDraftController} from "./http/finance-voucher-drafts.controller";

/** CG-09 owns a single ledger and finance setup; never duplicates CG-01/02 masters. */
@Module({
 imports:[IdentityAccessModule,FoundationStructureModule],
 providers:[FinanceAccountsService,FinanceJournalPostingService,FinanceVoucherDraftService],
 controllers:[FinanceAccountsController,FinanceVoucherDraftController],
 exports:[FinanceAccountsService]
})
export class FinanceAccountingModule {}
