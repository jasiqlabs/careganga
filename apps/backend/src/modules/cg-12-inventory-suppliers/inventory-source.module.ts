import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {InventoryCatalogService} from "./application/inventory-catalog.service";
import {InventoryReceiptDraftSource} from "./application/inventory-receipt-draft-source";
@Module({imports:[IdentityAccessModule],providers:[InventoryCatalogService,InventoryReceiptDraftSource],exports:[InventoryCatalogService,InventoryReceiptDraftSource]})
export class InventorySourceModule {}
