import {Module} from "@nestjs/common";
import {ProjectsSourceModule} from "../cg-05-projects-field-operations/projects-source.module";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FinanceAccountingModule} from "../cg-09-finance-accounting/finance-accounting.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {DiagnosticsModule} from "../cg-16-healthcare-diagnostics/diagnostics.module";
import {PatientsAppointmentsModule} from "../cg-15-patients-appointments/patients-appointments.module";
import {MisDashboardService} from "./application/mis-dashboard.service";
import {MisDashboardController} from "./http/mis-dashboard.controller";
import {MisReportSourceService} from "./application/mis-report-source.service";
import {MisSavedReportService} from "./application/mis-saved-report.service";
import {MisReportRunService} from "./application/mis-report-run.service";
import {MisReportScheduleService} from "./application/mis-report-schedule.service";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {PlatformConfigurationModule} from "../cg-21-platform-configuration-audit/platform-configuration.module";
import {MisReportsController} from "./http/mis-reports.controller";
import {MisReportScheduleWorker} from "./infrastructure/mis-report-schedule.worker";

/** CG-20 is a read-only consumer of verified source-owned projections. */
@Module({
 imports:[ProjectsSourceModule,IdentityAccessModule,FoundationStructureModule,FinanceAccountingModule,DiagnosticsModule,PatientsAppointmentsModule,
  DocumentsNotificationsModule,PlatformConfigurationModule],
 providers:[MisDashboardService,MisReportSourceService,MisSavedReportService,MisReportRunService,MisReportScheduleService,MisReportScheduleWorker],
 controllers:[MisDashboardController,MisReportsController]
})
export class MisReportingModule{}
