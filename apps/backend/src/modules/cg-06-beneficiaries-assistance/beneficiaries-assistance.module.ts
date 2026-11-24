import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {InventorySourceModule} from "../cg-12-inventory-suppliers/inventory-source.module";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {AssistanceFulfillmentService} from "./application/assistance-fulfillment.service";
import {BeneficiariesSourceModule} from "./beneficiaries-source.module";
import {AssistanceController} from "./http/assistance.controller";
import {BeneficiariesController} from "./http/beneficiaries.controller";

@Module({
 imports:[BeneficiariesSourceModule,IdentityAccessModule,InventorySourceModule,FinanceSourceModule,DocumentsNotificationsModule],
 providers:[AssistanceFulfillmentService],
 controllers:[BeneficiariesController,AssistanceController],
 exports:[BeneficiariesSourceModule]
})
export class BeneficiariesAssistanceModule{}
