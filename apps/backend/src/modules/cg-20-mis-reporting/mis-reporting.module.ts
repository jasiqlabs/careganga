import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FinanceAccountingModule} from "../cg-09-finance-accounting/finance-accounting.module";
import {DiagnosticsModule} from "../cg-16-healthcare-diagnostics/diagnostics.module";
import {PatientsAppointmentsModule} from "../cg-15-patients-appointments/patients-appointments.module";
import {MisDashboardService} from "./application/mis-dashboard.service";
import {MisDashboardController} from "./http/mis-dashboard.controller";

/** CG-20 is a read-only consumer of verified source-owned projections. */
@Module({
 imports:[IdentityAccessModule,FinanceAccountingModule,DiagnosticsModule,PatientsAppointmentsModule],
 providers:[MisDashboardService],
 controllers:[MisDashboardController]
})
export class MisReportingModule{}
