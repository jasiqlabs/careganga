import {Module} from "@nestjs/common";
import {HrPublicBioEditorialSource} from "./application/hr-public-bio-editorial-source";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {HrDocumentSourceFacade} from "./application/hr-document-source.facade";
import {HrEmploymentChangeSourceFacade} from "./application/hr-employment-change-source.facade";
import {HrAttendanceCorrectionSourceFacade} from "./application/hr-attendance-correction-source.facade";
import {HrLeaveSourceFacade} from "./application/hr-leave-source.facade";
import {HrPayrollEmployeeSourceFacade} from "./application/hr-payroll-employee-source.facade";
import {HrPayrollAttendanceSourceFacade} from "./application/hr-payroll-attendance-source.facade";
import {HrEnrollmentSourceFacade} from "./application/hr-enrollment-source.facade";
/** Narrow owner contract to CG03 and original CG19: no CG10 HR DB writes elsewhere. */
@Module({imports:[IdentityAccessModule,FoundationStructureModule],providers:[HrPublicBioEditorialSource,HrDocumentSourceFacade,HrEmploymentChangeSourceFacade,HrEnrollmentSourceFacade,HrLeaveSourceFacade,HrAttendanceCorrectionSourceFacade,HrPayrollAttendanceSourceFacade,HrPayrollEmployeeSourceFacade],
 exports:[HrPublicBioEditorialSource,HrDocumentSourceFacade,HrEmploymentChangeSourceFacade,HrEnrollmentSourceFacade,HrLeaveSourceFacade,HrAttendanceCorrectionSourceFacade,HrPayrollAttendanceSourceFacade,HrPayrollEmployeeSourceFacade]})
export class HrSourceModule{}
