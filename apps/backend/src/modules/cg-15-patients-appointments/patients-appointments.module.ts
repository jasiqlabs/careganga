import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {DoctorScheduleService} from "./application/doctor-schedule.service";
import {DoctorScheduleController} from "./http/doctor-schedule.controller";

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule],
 providers:[DoctorScheduleService],
 controllers:[DoctorScheduleController],
 exports:[DoctorScheduleService]
})
export class PatientsAppointmentsModule{}
