import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {InventorySourceModule} from "./inventory-source.module";
import {InventoryStockService} from "./application/inventory-stock.service";
import {InventoryCatalogController} from "./http/inventory-catalog.controller";
import {InventoryStockController} from "./http/inventory-stock.controller";
import {RegistrationApprovalsModule} from '../cg-03-registration-approvals/registration-approvals.module';
import {InventoryMaterialService} from './application/inventory-material.service';
import {InventoryMaterialController} from './http/inventory-material.controller';
@Module({imports:[RegistrationApprovalsModule,IdentityAccessModule,InventorySourceModule,DocumentsNotificationsModule],providers:[InventoryStockService,InventoryMaterialService],controllers:[InventoryCatalogController,InventoryStockController,InventoryMaterialController]})
export class InventorySuppliersModule {}
