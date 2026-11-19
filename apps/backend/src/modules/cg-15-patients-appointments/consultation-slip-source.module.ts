import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {ConsultationSlipSourceFacade} from "./application/consultation-slip-source.facade";
import {HealthCenterSupportScopeFacade}
 from "../cg-14-healthcare-network/application/health-center-support-scope.facade";
/** CG-19 consumes only this CG-15 original read source. No circular import. */
@Module({
 imports:[IdentityAccessModule],
 providers:[ConsultationSlipSourceFacade,HealthCenterSupportScopeFacade],
 exports:[ConsultationSlipSourceFacade]
})
export class ConsultationSlipSourceModule{}
