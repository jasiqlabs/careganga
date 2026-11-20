import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HealthcareAssistancePolicyService}
 from "./application/healthcare-assistance-policy.service";
import {HealthcareAssistancePolicyController}
 from "./http/healthcare-assistance-policy.controller";
@Module({
 imports:[IdentityAccessModule],
 providers:[HealthcareAssistancePolicyService],
 controllers:[HealthcareAssistancePolicyController],
 exports:[HealthcareAssistancePolicyService]
})
export class HealthcareAssistanceModule{}
