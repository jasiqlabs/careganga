import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {PatientsAppointmentsModule} from "../cg-15-patients-appointments/patients-appointments.module";
import {HealthcareAssistancePolicyService}
 from "./application/healthcare-assistance-policy.service";
import {HealthcareAssistancePolicyController}
 from "./http/healthcare-assistance-policy.controller";
@Module({
 imports:[IdentityAccessModule,RegistrationApprovalsModule,PatientsAppointmentsModule],
 providers:[HealthcareAssistancePolicyService],
 controllers:[HealthcareAssistancePolicyController],
 exports:[HealthcareAssistancePolicyService]
})
export class HealthcareAssistanceModule{}
