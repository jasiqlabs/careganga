import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HrAttendanceCorrectionService} from "./application/hr-attendance-correction.service";
import {HrAttendanceCorrectionController} from "./http/hr-attendance-correction.controller";
import {HrAppraisalService} from "./application/hr-appraisal.service";
import {HrAppraisalController} from "./http/hr-appraisal.controller";
import {HrLeaveService} from "./application/hr-leave.service";
import {HrLeaveController} from "./http/hr-leave.controller";
import {HrAttendanceService} from "./application/hr-attendance.service";
import {HrAttendanceController} from "./http/hr-attendance.controller";
import {HrEnrollmentService} from "./application/hr-enrollment.service";
import {HrPrivateDetailService} from "./application/hr-private-detail.service";
import {HrPublicBioConsentService} from "./application/hr-public-bio-consent.service";
import {HrPublicBioConsentController} from "./http/hr-public-bio-consent.controller";
import {HrPrivateDetailController} from "./http/hr-private-detail.controller";
import {HrSourceModule} from "./hr-source.module";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {HrEvidenceSourceModule} from "../cg-19-documents-notifications/hr-evidence-source.module";
import {HrEnrollmentController} from "./http/hr-enrollment.controller";

/** CG-10 owns private HR draft and employee read projections; no second login,
 * approval case, file store or salary ledger authority is created here.
 */
@Module({
 imports:[IdentityAccessModule,HrSourceModule,RegistrationApprovalsModule,HrEvidenceSourceModule],
 providers:[HrAppraisalService,HrAttendanceCorrectionService,HrLeaveService,HrEnrollmentService,HrPrivateDetailService,HrPublicBioConsentService,HrAttendanceService],
 controllers:[HrAppraisalController,HrAttendanceCorrectionController,HrLeaveController,HrEnrollmentController,HrPrivateDetailController,HrPublicBioConsentController,HrAttendanceController],
 exports:[HrEnrollmentService,HrPublicBioConsentService]
})
export class HrEnrollmentModule{}
