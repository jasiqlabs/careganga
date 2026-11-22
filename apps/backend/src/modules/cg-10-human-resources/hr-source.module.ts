import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HrEmploymentChangeSourceFacade} from "./application/hr-employment-change-source.facade";
import {HrAttendanceCorrectionSourceFacade} from "./application/hr-attendance-correction-source.facade";
import {HrLeaveSourceFacade} from "./application/hr-leave-source.facade";
import {HrPayrollAttendanceSourceFacade} from "./application/hr-payroll-attendance-source.facade";
import {HrEnrollmentSourceFacade} from "./application/hr-enrollment-source.facade";
/** Narrow owner contract to CG03 and original CG19: no CG10 HR DB writes elsewhere. */
@Module({imports:[IdentityAccessModule],providers:[HrEmploymentChangeSourceFacade,HrEnrollmentSourceFacade,HrLeaveSourceFacade,HrAttendanceCorrectionSourceFacade,HrPayrollAttendanceSourceFacade],
 exports:[HrEmploymentChangeSourceFacade,HrEnrollmentSourceFacade,HrLeaveSourceFacade,HrAttendanceCorrectionSourceFacade,HrPayrollAttendanceSourceFacade]})
export class HrSourceModule{}
