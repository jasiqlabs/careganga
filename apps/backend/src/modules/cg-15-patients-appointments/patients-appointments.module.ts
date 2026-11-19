import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {DoctorScheduleService} from "./application/doctor-schedule.service";
import {DoctorScheduleController} from "./http/doctor-schedule.controller";
import {DoctorAvailabilityService} from "./application/doctor-availability.service";
import {DoctorAvailabilityController} from "./http/doctor-availability.controller";
import {PatientProfileService} from "./application/patient-profile.service";
import {PatientProfileController} from "./http/patient-profile.controller";
import {CenterPatientIntakeService} from "./application/center-patient-intake.service";
import {CenterPatientIntakeController} from "./http/center-patient-intake.controller";
import {CenterPatientIntakeService} from "./application/center-patient-intake.service";
import {CenterPatientIntakeController} from "./http/center-patient-intake.controller";

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule,RegistrationApprovalsModule],
 providers:[DoctorScheduleService,DoctorAvailabilityService,PatientProfileService,CenterPatientIntakeService],
 controllers:[DoctorScheduleController,DoctorAvailabilityController,PatientProfileController,CenterPatientIntakeController],
 exports:[DoctorScheduleService]
})
export class PatientsAppointmentsModule{}
