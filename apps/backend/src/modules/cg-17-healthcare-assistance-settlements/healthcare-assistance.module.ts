import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {PatientsAppointmentsModule} from "../cg-15-patients-appointments/patients-appointments.module";
 import {ConsultationPatientChargeService} from "./application/consultation-patient-charge.service";
import {ConsultationPatientChargeController} from "./http/consultation-patient-charge.controller";
import {HealthcareAssistancePolicyService}
 from "./application/healthcare-assistance-policy.service";
import {HealthcareAssistancePolicyController}
 from "./http/healthcare-assistance-policy.controller";
@Module({
 imports:[IdentityAccessModule,RegistrationApprovalsModule,PatientsAppointmentsModule],
 providers:[HealthcareAssistancePolicyService,ConsultationPatientChargeService],
 controllers:[HealthcareAssistancePolicyController,ConsultationPatientChargeController],
 exports:[HealthcareAssistancePolicyService,ConsultationPatientChargeService]
})
export class HealthcareAssistanceModule{}
