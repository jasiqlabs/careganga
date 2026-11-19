import { Module } from "@nestjs/common";
import { DatabaseModule } from "./core/infrastructure/database.module";
import { HealthController } from "./core/http/health.controller";
import { IdentityAccessModule } from "./modules/cg-01-identity-access/identity-access.module";
import { PlatformConfigurationModule } from "./modules/cg-21-platform-configuration-audit/platform-configuration.module";
import { RegistrationApprovalsModule } from "./modules/cg-03-registration-approvals/registration-approvals.module";
import { DocumentsNotificationsModule } from "./modules/cg-19-documents-notifications/documents-notifications.module";
import { FoundationStructureModule } from "./modules/cg-02-foundation-structure/foundation-structure.module";
import { FinanceAccountingModule } from "./modules/cg-09-finance-accounting/finance-accounting.module";
import { CmsPublicContentModule } from "./modules/cg-18-cms-public-content/cms-public-content.module";
import { HealthNetworkModule } from "./modules/cg-14-healthcare-network/health-network.module";
import { PatientsAppointmentsModule } from "./modules/cg-15-patients-appointments/patients-appointments.module";

@Module({ imports: [DatabaseModule, IdentityAccessModule, PlatformConfigurationModule, RegistrationApprovalsModule, DocumentsNotificationsModule, FoundationStructureModule, FinanceAccountingModule, CmsPublicContentModule, HealthNetworkModule, PatientsAppointmentsModule], controllers: [HealthController] })
export class AppModule {}
