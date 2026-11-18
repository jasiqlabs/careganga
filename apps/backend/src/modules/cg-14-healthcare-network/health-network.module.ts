import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {HealthReviewWorkflowService} from "./application/health-review-workflow.service";
import {HealthPublicCenterService} from "./application/health-public-center.service";
import {HealthPublicCenterController} from "./http/health-public-center.controller";
import {HealthNetworkService} from "./application/health-network.service";
import {HealthNetworkController} from "./http/health-network.controller";
import {HealthDoctorDraftService} from "./application/health-doctor-draft.service";
import {HealthDoctorDraftController} from "./http/health-doctor-draft.controller";
import {HealthDoctorReviewWorkflowService} from "./application/health-doctor-review-workflow.service";
import {HealthDoctorReviewSourceFacade} from "./application/health-doctor-review-source.facade";

@Module({
  imports:[IdentityAccessModule,DocumentsNotificationsModule,RegistrationApprovalsModule],
  providers:[HealthNetworkService,HealthReviewWorkflowService,HealthPublicCenterService,HealthDoctorDraftService,HealthDoctorReviewWorkflowService,HealthDoctorReviewSourceFacade],
  controllers:[HealthNetworkController,HealthPublicCenterController,HealthDoctorDraftController],
  exports:[HealthNetworkService,HealthReviewWorkflowService,HealthDoctorDraftService,HealthDoctorReviewWorkflowService]
})
export class HealthNetworkModule{}
