import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FinanceAccountingModule} from "../cg-09-finance-accounting/finance-accounting.module";
import {MisDashboardService} from "./application/mis-dashboard.service";
import {MisDashboardController} from "./http/mis-dashboard.controller";

/** CG-20 is a read-only consumer of verified source-owned projections. */
@Module({
 imports:[IdentityAccessModule,FinanceAccountingModule],
 providers:[MisDashboardService],
 controllers:[MisDashboardController]
})
export class MisReportingModule{}
