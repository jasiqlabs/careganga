import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {InventoryCatalogService} from "./application/inventory-catalog.service";
import {InventoryReceiptDraftSource} from "./application/inventory-receipt-draft-source";
import {InventoryMaterialSource} from "./application/inventory-material-source";
import {InventoryOperationSource} from './application/inventory-operation-source';
@Module({imports:[IdentityAccessModule,FoundationStructureModule],providers:[InventoryCatalogService,InventoryReceiptDraftSource,InventoryMaterialSource,InventoryOperationSource],exports:[InventoryCatalogService,InventoryReceiptDraftSource,InventoryMaterialSource,InventoryOperationSource]})
export class InventorySourceModule {}
