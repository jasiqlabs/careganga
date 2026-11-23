import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {InventorySourceModule} from "../cg-12-inventory-suppliers/inventory-source.module";
import {ReferralCatalogService} from "./application/referral-catalog.service";
import {ReferralCatalogController} from "./http/referral-catalog.controller";
import {ReferralSelfService} from "./application/referral-self.service";
import {ReferralSelfController} from "./http/referral-self.controller";
import {ReferralResolveService} from "./application/referral-resolve.service";
import {ReferralResolveController} from "./http/referral-resolve.controller";

@Module({
 imports:[IdentityAccessModule,InventorySourceModule],
 providers:[ReferralCatalogService,ReferralSelfService,ReferralResolveService],
 controllers:[ReferralCatalogController,ReferralSelfController,ReferralResolveController],
 exports:[ReferralCatalogService,ReferralSelfService]
})
export class ReferralsRewardsModule {}
