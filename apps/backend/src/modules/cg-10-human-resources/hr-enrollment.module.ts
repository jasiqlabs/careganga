import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HrEnrollmentService} from "./application/hr-enrollment.service";
import {HrEnrollmentController} from "./http/hr-enrollment.controller";

/** CG-10 owns private HR draft and employee read projections; no second login,
 * approval case, file store or salary ledger authority is created here.
 */
@Module({
 imports:[IdentityAccessModule],
 providers:[HrEnrollmentService],
 controllers:[HrEnrollmentController],
 exports:[HrEnrollmentService]
})
export class HrEnrollmentModule{}
