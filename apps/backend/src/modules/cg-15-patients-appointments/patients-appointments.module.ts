import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {DoctorScheduleService} from "./application/doctor-schedule.service";
import {DoctorScheduleController} from "./http/doctor-schedule.controller";
import {DoctorAvailabilityService} from "./application/doctor-availability.service";
import {DoctorAvailabilityController} from "./http/doctor-availability.controller";
import {PatientProfileService} from "./application/patient-profile.service";
import {PatientPrivateDetailsService} from "./application/patient-private-details.service";
import {PatientProfileController} from "./http/patient-profile.controller";
import {CenterPatientIntakeService} from "./application/center-patient-intake.service";
import {CenterPatientIntakeController} from "./http/center-patient-intake.controller";
import {ConsultationBookingService} from "./application/consultation-booking.service";
import {ConsultationChargeSourceFacade} from "./application/consultation-charge-source.facade";
import {ConsultationCompletionSourceFacade} from "./application/consultation-completion-source.facade";
import {ConsultationBookingController} from "./http/consultation-booking.controller";
import {ConsultationQueueService} from "./application/consultation-queue.service";
import {ConsultationQueueController} from "./http/consultation-queue.controller";
import {PatientAdminOverviewService} from "./application/patient-admin-overview.service";
import {PatientAdminOverviewController} from "./http/patient-admin-overview.controller";

@Module({
 imports:[IdentityAccessModule,HealthNetworkModule,RegistrationApprovalsModule],
 providers:[DoctorScheduleService,DoctorAvailabilityService,PatientProfileService,PatientPrivateDetailsService,CenterPatientIntakeService,ConsultationBookingService,ConsultationChargeSourceFacade,ConsultationCompletionSourceFacade,ConsultationQueueService,PatientAdminOverviewService],
 controllers:[DoctorScheduleController,DoctorAvailabilityController,PatientProfileController,CenterPatientIntakeController,ConsultationBookingController,ConsultationQueueController,PatientAdminOverviewController],
 exports:[DoctorScheduleService,ConsultationChargeSourceFacade,ConsultationCompletionSourceFacade]
})
export class PatientsAppointmentsModule{}
