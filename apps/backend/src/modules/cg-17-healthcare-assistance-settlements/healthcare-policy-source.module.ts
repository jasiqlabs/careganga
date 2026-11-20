import {Module} from "@nestjs/common";
import {HealthcareAssistanceReviewSourceFacade}
 from "./application/healthcare-assistance-review-source.facade";
@Module({
 providers:[HealthcareAssistanceReviewSourceFacade],
 exports:[HealthcareAssistanceReviewSourceFacade]
})
export class HealthcarePolicySourceModule{}
