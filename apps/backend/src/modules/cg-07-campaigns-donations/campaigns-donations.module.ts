import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {ProjectsSourceModule} from "../cg-05-projects-field-operations/projects-source.module";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {DonationBankService} from "./application/donation-bank.service";
import {DonationBankController} from "./http/donation-bank.controller";
import {DonationAdminService} from "./application/donation-admin.service";
import {DonationAdminController} from "./http/donation-admin.controller";
import {DonationManualService} from "./application/donation-manual.service";
import {DonationManualController} from "./http/donation-manual.controller";
import {DonationRefundService} from "./application/donation-refund.service";
import {DonationRefundController} from "./http/donation-refund.controller";
import {DonationProviderRefundService} from "./application/donation-provider-refund.service";
import {DonationProviderRefundController} from "./http/donation-provider-refund.controller";
import {DonationReceiptSourceFacade} from "./application/donation-receipt-source.facade";
import {CampaignDraftsService} from "./application/campaign-drafts.service";
import {DonationIntentsService} from "./application/donation-intents.service";
import {DonationOnlineFinanceService} from "./application/donation-online-finance.service";
import {DonationOnlineFinanceController} from "./http/donation-online-finance.controller";
import {DonationOnlineService} from "./application/donation-online.service";
import {DonationOnlineController} from "./http/donation-online.controller";
import {PublicDonationIntentsController} from "./http/public-donation-intents.controller";
import {CampaignDraftsController} from "./http/campaign-drafts.controller";
@Module({imports:[IdentityAccessModule,FoundationStructureModule,ProjectsSourceModule,FinanceSourceModule],
 providers:[DonationBankService,DonationRefundService,DonationProviderRefundService,DonationReceiptSourceFacade,CampaignDraftsService,DonationIntentsService,DonationManualService,DonationAdminService,DonationOnlineService,DonationOnlineFinanceService],controllers:[DonationBankController,DonationRefundController,DonationProviderRefundController,CampaignDraftsController,PublicDonationIntentsController,DonationManualController,DonationAdminController,DonationOnlineController,DonationOnlineFinanceController],exports:[DonationAdminService,CampaignDraftsService,DonationReceiptSourceFacade,DonationIntentsService]})
export class CampaignsDonationsModule{}
