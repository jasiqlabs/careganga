import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HrAttendanceCorrectionSourceFacade} from "./application/hr-attendance-correction-source.facade";
import {HrLeaveSourceFacade} from "./application/hr-leave-source.facade";
import {HrEnrollmentSourceFacade} from "./application/hr-enrollment-source.facade";
/** Narrow owner contract to CG03 and original CG19: no CG10 HR DB writes elsewhere. */
@Module({imports:[IdentityAccessModule],providers:[HrEnrollmentSourceFacade,HrLeaveSourceFacade,HrAttendanceCorrectionSourceFacade],
 exports:[HrEnrollmentSourceFacade,HrLeaveSourceFacade,HrAttendanceCorrectionSourceFacade]})
export class HrSourceModule{}
