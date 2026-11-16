import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {PrivateEvidenceService} from "./application/private-evidence.service";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider} from "./infrastructure/private-storage-provider.factory";
import {PrivateEvidenceController} from "./http/private-evidence.controller";
import {PrivateLetterController} from "./http/private-letter.controller";
import {PrivateLetterService} from "./application/private-letter.service";

/** CG-19 owns private media/documents/communications/helpdesk. Only US-001
 * source-backed private evidence is registered until the later stories.
 * Firebase or AWS S3 is selected explicitly per client deployment.
 * Missing secured credentials or a real ClamAV scanner stays unavailable.
 */
@Module({
  imports:[IdentityAccessModule,RegistrationApprovalsModule],
  controllers:[PrivateEvidenceController,PrivateLetterController],
  providers:[PrivateEvidenceService,PrivateLetterService,
    {provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
  exports:[PrivateEvidenceService,PrivateLetterService]
})
export class DocumentsNotificationsModule{}
