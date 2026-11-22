import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {InventoryCatalogService} from "./application/inventory-catalog.service";
import {InventoryCatalogController} from "./http/inventory-catalog.controller";
@Module({imports:[IdentityAccessModule],providers:[InventoryCatalogService],controllers:[InventoryCatalogController]})
export class InventorySuppliersModule {}
