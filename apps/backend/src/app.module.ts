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
import { DiagnosticsModule } from "./modules/cg-16-healthcare-diagnostics/diagnostics.module";
import { HealthcareAssistanceModule } from "./modules/cg-17-healthcare-assistance-settlements/healthcare-assistance.module";
import { MisReportingModule } from "./modules/cg-20-mis-reporting/mis-reporting.module";
import { HrEnrollmentModule } from "./modules/cg-10-human-resources/hr-enrollment.module";

import { ProjectsFieldOperationsModule } from "./modules/cg-05-projects-field-operations/projects-field-operations.module";
import { InventorySuppliersModule } from "./modules/cg-12-inventory-suppliers/inventory-suppliers.module";
import { MembershipVolunteersModule } from "./modules/cg-04-membership-volunteers/membership-volunteers.module";
import {CsrFundingModule} from "./modules/cg-08-csr-funding/csr-funding.module";
import {CampaignsDonationsModule} from "./modules/cg-07-campaigns-donations/campaigns-donations.module";
import {ReferralsRewardsModule} from "./modules/cg-13-referrals-rewards/referrals-rewards.module";
import {PayrollCompensationModule} from "./modules/cg-11-payroll-compensation/payroll-compensation.module";
import {BeneficiariesAssistanceModule} from "./modules/cg-06-beneficiaries-assistance/beneficiaries-assistance.module";
@Module({ imports: [DatabaseModule, IdentityAccessModule, PlatformConfigurationModule, RegistrationApprovalsModule, DocumentsNotificationsModule, FoundationStructureModule, FinanceAccountingModule, CmsPublicContentModule, HealthNetworkModule, PatientsAppointmentsModule, DiagnosticsModule, HealthcareAssistanceModule, MisReportingModule, HrEnrollmentModule, InventorySuppliersModule, ProjectsFieldOperationsModule, MembershipVolunteersModule, CampaignsDonationsModule, CsrFundingModule, ReferralsRewardsModule, BeneficiariesAssistanceModule, PayrollCompensationModule], controllers: [HealthController] })
export class AppModule {}
