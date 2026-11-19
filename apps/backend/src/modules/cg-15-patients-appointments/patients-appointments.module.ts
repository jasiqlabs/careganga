import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {DoctorScheduleService} from "./application/doctor-schedule.service";
import {DoctorScheduleController} from "./http/doctor-schedule.controller";
import {DoctorAvailabilityService} from "./application/doctor-availability.service";
import {DoctorAvailabilityController} from "./http/doctor-availability.controller";

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule,RegistrationApprovalsModule],
 providers:[DoctorScheduleService,DoctorAvailabilityService],
 controllers:[DoctorScheduleController,DoctorAvailabilityController],
 exports:[DoctorScheduleService]
})
export class PatientsAppointmentsModule{}
