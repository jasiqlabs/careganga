import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {BranchPrivateEvidenceService} from "./application/branch-private-evidence.service";
import {BranchWorkflowService} from "./application/branch-workflow.service";
import {BranchPrivateEvidenceController} from "./http/branch-private-evidence.controller";
import {BranchWorkflowController} from "./http/branch-workflow.controller";
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
  imports:[IdentityAccessModule,RegistrationApprovalsModule,FoundationStructureModule],
  controllers:[PrivateEvidenceController,PrivateLetterController,BranchPrivateEvidenceController,BranchWorkflowController],
  providers:[PrivateEvidenceService,PrivateLetterService,BranchPrivateEvidenceService,BranchWorkflowService,
    {provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
  exports:[PrivateEvidenceService,PrivateLetterService,BranchPrivateEvidenceService]
})
export class DocumentsNotificationsModule{}
