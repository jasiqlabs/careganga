import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
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
  imports:[IdentityAccessModule,RegistrationApprovalsModule],
  controllers:[PrivateEvidenceController,PrivateLetterController,
    CommunicationsController,CommunicationProviderWebhookController,SupportController],
  providers:[PrivateEvidenceService,PrivateLetterService,
    NotificationService,NoticeService,DeliveryService,
    CommunicationProviders,CommunicationWorker,SupportService,
    {provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
  exports:[PrivateEvidenceService,PrivateLetterService,SupportService]
})
export class DocumentsNotificationsModule{}
