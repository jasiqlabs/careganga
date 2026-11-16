import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {BranchPrivateEvidenceService} from "./application/branch-private-evidence.service";
import {BranchWorkflowService} from "./application/branch-workflow.service";
import {ActiveBranchEvidenceService} from "./application/active-branch-evidence.service";
import {ActiveBranchEvidenceController} from "./http/active-branch-evidence.controller";
import {BranchPrivateEvidenceController} from "./http/branch-private-evidence.controller";
import {BranchWorkflowController} from "./http/branch-workflow.controller";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {PrivateEvidenceService} from "./application/private-evidence.service";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider} from "./infrastructure/private-storage-provider.factory";
import {PrivateEvidenceController} from "./http/private-evidence.controller";
import {PrivateLetterController} from "./http/private-letter.controller";
import {PrivateLetterService} from "./application/private-letter.service";
import {NotificationService} from "./application/notification.service";
import {NoticeService} from "./application/notice.service";
import {DeliveryService} from "./application/delivery.service";
import {CommunicationProviders} from "./infrastructure/channel-providers";
import {CommunicationWorker} from "./infrastructure/communication-worker";
import {SupportService} from "./application/support.service";
import {SupportController} from "./http/support.controller";
import {CommunicationsController,CommunicationProviderWebhookController} from
  "./http/communications.controller";

/** CG-19 owns private media/documents, US-002 communications and US-003
 * Foundation-only contact/helpdesk. No speculative center/CMS source.
 * Firebase or AWS S3 is selected explicitly per client deployment.
 * Missing secured credentials or a real ClamAV scanner stays unavailable.
 */
@Module({
  imports:[IdentityAccessModule,RegistrationApprovalsModule,FoundationStructureModule],
  controllers:[PrivateEvidenceController,PrivateLetterController,BranchPrivateEvidenceController,BranchWorkflowController,ActiveBranchEvidenceController,
    CommunicationsController,CommunicationProviderWebhookController,SupportController],
  providers:[PrivateEvidenceService,PrivateLetterService,BranchPrivateEvidenceService,BranchWorkflowService,ActiveBranchEvidenceService,
    NotificationService,NoticeService,DeliveryService,
    CommunicationProviders,CommunicationWorker,SupportService,
    {provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
  exports:[PrivateEvidenceService,PrivateLetterService,SupportService,BranchPrivateEvidenceService,ActiveBranchEvidenceService]
})
export class DocumentsNotificationsModule{}
