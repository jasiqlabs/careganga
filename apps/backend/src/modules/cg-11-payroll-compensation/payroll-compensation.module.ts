import {PayrollPayslipSourceFacade} from "./application/payroll-payslip-source.facade";
import {PayrollPaymentService} from "./application/payroll-payment.service";
import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {HrSourceModule} from "../cg-10-human-resources/hr-source.module";
import {PayrollRunService} from "./application/payroll-run.service";
import {PayrollRunController} from "./http/payroll-run.controller";
import {PayrollCompensationService} from "./application/payroll-compensation.service";
import {PayrollCompensationController} from "./http/payroll-compensation.controller";
@Module({imports:[IdentityAccessModule,FoundationStructureModule,HrSourceModule,FinanceSourceModule],providers:[PayrollPayslipSourceFacade,PayrollPaymentService,PayrollCompensationService,PayrollRunService],controllers:[PayrollCompensationController,PayrollRunController],exports:[PayrollPayslipSourceFacade,PayrollCompensationService,PayrollRunService]})
export class PayrollCompensationModule{}
