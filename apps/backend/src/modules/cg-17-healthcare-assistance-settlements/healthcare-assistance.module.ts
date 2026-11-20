import {Module} from "@nestjs/common";
import {CenterMerchantProvisioningService} from "./application/center-merchant-provisioning.service";
import {CenterMerchantCheckoutService} from "./application/center-merchant-checkout.service";
import {CenterMerchantController} from "./http/center-merchant.controller";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {PatientsAppointmentsModule} from "../cg-15-patients-appointments/patients-appointments.module";
import {HealthNetworkModule} from "../cg-14-healthcare-network/health-network.module";
import {PublicHealthcareAssistanceService} from "./application/public-healthcare-assistance.service";
import {CenterPatientCollectionService} from "./application/center-patient-collection.service";
import {CenterPatientCollectionController} from "./http/center-patient-collection.controller";
import {PublicHealthcareAssistanceController} from "./http/public-healthcare-assistance.controller";
import {HealthcarePolicyApprovalService} from "./application/healthcare-policy-approval.service";
import {HealthcarePolicyApprovalController} from "./http/healthcare-policy-approval.controller";
import {HealthcareAssistanceReviewSourceFacade} from "./application/healthcare-assistance-review-source.facade";
import {ConsultationPatientChargeService} from "./application/consultation-patient-charge.service";
import {ConsultationPatientChargeController} from "./http/consultation-patient-charge.controller";
import {HealthcareAssistancePolicyService}
 from "./application/healthcare-assistance-policy.service";
import {HealthcareAssistancePolicyController}
 from "./http/healthcare-assistance-policy.controller";
@Module({
 imports:[IdentityAccessModule,HealthNetworkModule,PatientsAppointmentsModule],
 providers:[CenterPatientCollectionService,PublicHealthcareAssistanceService,HealthcareAssistanceReviewSourceFacade,HealthcarePolicyApprovalService,HealthcareAssistancePolicyService,ConsultationPatientChargeService],
 controllers:[CenterPatientCollectionController,PublicHealthcareAssistanceController,HealthcarePolicyApprovalController,HealthcareAssistancePolicyController,ConsultationPatientChargeController],
 exports:[HealthcareAssistancePolicyService,ConsultationPatientChargeService]
})
export class HealthcareAssistanceModule{}
