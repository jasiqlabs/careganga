import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {InventorySourceModule} from "../cg-12-inventory-suppliers/inventory-source.module";
import {ReferralCatalogService} from "./application/referral-catalog.service";
import {ReferralCatalogController} from "./http/referral-catalog.controller";

@Module({
 imports:[IdentityAccessModule,InventorySourceModule],
 providers:[ReferralCatalogService],
 controllers:[ReferralCatalogController],
 exports:[ReferralCatalogService]
})
export class ReferralsRewardsModule {}
