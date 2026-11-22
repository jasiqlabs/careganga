import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {CampaignDraftsService} from "./application/campaign-drafts.service";
import {CampaignDraftsController} from "./http/campaign-drafts.controller";
@Module({imports:[IdentityAccessModule,FoundationStructureModule],
 providers:[CampaignDraftsService],controllers:[CampaignDraftsController]})
export class CampaignsDonationsModule{}
