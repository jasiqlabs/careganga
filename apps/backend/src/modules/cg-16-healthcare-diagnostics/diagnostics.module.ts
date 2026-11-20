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
import {ClinicalLabOptionsService} from "./application/clinical-lab-options.service";
import {ClinicalLabCustodyService} from "./application/clinical-lab-custody.service";
import {ClinicalLabResultEvidenceService} from "./application/clinical-lab-result-evidence.service";
import {ClinicalLabProfessionalReviewService} from "./application/clinical-lab-professional-review.service";
import {LabResultStorageModule} from "../cg-19-documents-notifications/lab-result-storage.module";

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule,LabResultStorageModule],
 providers:[DiagnosticsCatalogService,DiagnosticsPublicCatalogService,DiagnosticsPriceReviewSource,ClinicalLabAdmissionService,ClinicalLabOrderService,ClinicalLabOptionsService,ClinicalLabCustodyService,ClinicalLabResultEvidenceService,ClinicalLabProfessionalReviewService],
 controllers:[DiagnosticsCatalogController,DiagnosticsPublicCatalogController,ClinicalLabOrderController],
 exports:[DiagnosticsCatalogService]
})
export class DiagnosticsModule{}
