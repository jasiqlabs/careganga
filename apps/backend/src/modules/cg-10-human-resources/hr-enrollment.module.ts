import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HrEnrollmentService} from "./application/hr-enrollment.service";
import {HrPrivateDetailService} from "./application/hr-private-detail.service";
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
 providers:[HrEnrollmentService],
 controllers:[HrEnrollmentController],
 exports:[HrEnrollmentService]
})
export class HrEnrollmentModule{}
