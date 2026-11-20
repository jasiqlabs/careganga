import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {DiagnosticsCatalogService} from "./application/diagnostics-catalog.service";
import {DiagnosticsCatalogController} from "./http/diagnostics-catalog.controller";
import {DiagnosticsPublicCatalogService} from "./application/diagnostics-public-catalog.service";
import {DiagnosticsPublicCatalogController} from "./http/diagnostics-public-catalog.controller";

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule],
 providers:[DiagnosticsCatalogService,DiagnosticsPublicCatalogService],
 controllers:[DiagnosticsCatalogController,DiagnosticsPublicCatalogController],
 exports:[DiagnosticsCatalogService]
})
export class DiagnosticsModule{}
