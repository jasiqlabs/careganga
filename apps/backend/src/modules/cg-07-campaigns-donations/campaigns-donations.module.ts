import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {ProjectsSourceModule} from "../cg-05-projects-field-operations/projects-source.module";
import {CampaignDraftsService} from "./application/campaign-drafts.service";
import {DonationIntentsService} from "./application/donation-intents.service";
import {PublicDonationIntentsController} from "./http/public-donation-intents.controller";
import {CampaignDraftsController} from "./http/campaign-drafts.controller";
@Module({imports:[IdentityAccessModule,FoundationStructureModule,ProjectsSourceModule],
 providers:[CampaignDraftsService,DonationIntentsService],controllers:[CampaignDraftsController,PublicDonationIntentsController],exports:[CampaignDraftsService]})
export class CampaignsDonationsModule{}
