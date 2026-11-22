import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {InventorySourceModule} from "./inventory-source.module";
import {InventoryStockService} from "./application/inventory-stock.service";
import {InventoryCatalogController} from "./http/inventory-catalog.controller";
import {InventoryStockController} from "./http/inventory-stock.controller";
@Module({imports:[IdentityAccessModule,InventorySourceModule,DocumentsNotificationsModule],providers:[InventoryStockService],controllers:[InventoryCatalogController,InventoryStockController]})
export class InventorySuppliersModule {}
