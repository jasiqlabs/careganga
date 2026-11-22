import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {ProjectsSourceModule} from "../cg-05-projects-field-operations/projects-source.module";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {DonationAdminService} from "./application/donation-admin.service";
import {DonationAdminController} from "./http/donation-admin.controller";
import {DonationManualService} from "./application/donation-manual.service";
import {DonationManualController} from "./http/donation-manual.controller";
import {CampaignDraftsService} from "./application/campaign-drafts.service";
import {DonationIntentsService} from "./application/donation-intents.service";
import {PublicDonationIntentsController} from "./http/public-donation-intents.controller";
import {CampaignDraftsController} from "./http/campaign-drafts.controller";
@Module({imports:[IdentityAccessModule,FoundationStructureModule,ProjectsSourceModule,FinanceSourceModule],
 providers:[CampaignDraftsService,DonationIntentsService,DonationManualService,DonationAdminService],controllers:[CampaignDraftsController,PublicDonationIntentsController,DonationManualController,DonationAdminController],exports:[CampaignDraftsService]})
export class CampaignsDonationsModule{}
