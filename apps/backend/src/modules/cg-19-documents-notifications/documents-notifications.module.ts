import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {PrivateEvidenceService} from "./application/private-evidence.service";
import {PrivateObjectStorage,UnconfiguredPrivateObjectStorage} from "./infrastructure/private-object-storage";
import {PrivateEvidenceController} from "./http/private-evidence.controller";

/** CG-19 owns private media/documents/communications/helpdesk. Only US-001
 * source-backed private evidence is registered until the later stories.
 * Missing actual private storage must never produce a success state.
 */
@Module({
  imports:[IdentityAccessModule,RegistrationApprovalsModule],
  controllers:[PrivateEvidenceController],
  providers:[PrivateEvidenceService,UnconfiguredPrivateObjectStorage,
    {provide:PrivateObjectStorage,useExisting:UnconfiguredPrivateObjectStorage}],
  exports:[PrivateEvidenceService]
})
export class DocumentsNotificationsModule{}
