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

/** CG-09 owns a single ledger and finance setup; never duplicates CG-01/02 masters. */
@Module({
 imports:[IdentityAccessModule,FoundationStructureModule,RegistrationApprovalsModule,DocumentsNotificationsModule],
 providers:[FinanceAccountsService,FinanceJournalPostingService,FinanceVoucherDraftService],
 controllers:[FinanceAccountsController,FinanceVoucherDraftController],
 exports:[FinanceAccountsService]
})
export class FinanceAccountingModule {}
