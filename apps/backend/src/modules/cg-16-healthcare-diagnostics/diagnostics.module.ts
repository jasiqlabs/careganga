import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {DiagnosticsCatalogService} from "./application/diagnostics-catalog.service";
import {DiagnosticsCatalogController} from "./http/diagnostics-catalog.controller";
import {DiagnosticsPublicCatalogService} from "./application/diagnostics-public-catalog.service";
import {DiagnosticsPublicCatalogController} from "./http/diagnostics-public-catalog.controller";
import {DiagnosticsPriceReviewSource} from "./application/diagnostics-price-review.service";
import {ClinicalLabAdmissionService} from "./application/clinical-lab-admission.service";
import {ClinicalLabOrderService} from "./application/clinical-lab-order.service";
import {ClinicalLabOrderController} from "./http/clinical-lab-order.controller";

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule],
 providers:[DiagnosticsCatalogService,DiagnosticsPublicCatalogService,DiagnosticsPriceReviewSource,ClinicalLabAdmissionService,ClinicalLabOrderService],
 controllers:[DiagnosticsCatalogController,DiagnosticsPublicCatalogController,ClinicalLabOrderController],
 exports:[DiagnosticsCatalogService]
})
export class DiagnosticsModule{}
