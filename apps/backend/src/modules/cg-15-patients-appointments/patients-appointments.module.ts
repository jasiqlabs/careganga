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

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule,RegistrationApprovalsModule],
 providers:[DoctorScheduleService,DoctorAvailabilityService,PatientProfileService],
 controllers:[DoctorScheduleController,DoctorAvailabilityController,PatientProfileController],
 exports:[DoctorScheduleService]
})
export class PatientsAppointmentsModule{}
