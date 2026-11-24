import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {HrSourceModule} from "../cg-10-human-resources/hr-source.module";
import {PayrollCompensationService} from "./application/payroll-compensation.service";
import {PayrollCompensationController} from "./http/payroll-compensation.controller";
@Module({imports:[IdentityAccessModule,FoundationStructureModule,HrSourceModule],providers:[PayrollCompensationService],controllers:[PayrollCompensationController],exports:[PayrollCompensationService]})
export class PayrollCompensationModule{}
