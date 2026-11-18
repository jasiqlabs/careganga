import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {CmsEditorialService} from "./application/cms-editorial.service";
import {CmsPublicationDueWorker} from "./infrastructure/cms-publication-due.worker";
import {CmsEditorialController,CmsPublicPagesController} from "./http/cms-editorial.controller";
@Module({
 imports:[IdentityAccessModule,RegistrationApprovalsModule,DocumentsNotificationsModule],
 providers:[CmsEditorialService,CmsPublicationDueWorker],
 controllers:[CmsEditorialController,CmsPublicPagesController]
})
export class CmsPublicContentModule {}
