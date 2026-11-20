import {Module} from "@nestjs/common";
import {DoctorLeaveReviewSourceFacade} from "./application/doctor-leave-review-source.facade";

/** Read-only CG15 source adapter. CG03 imports this, never full CG15 module,
 * preventing a circular runtime dependency or a duplicate case master. */
@Module({
 providers:[DoctorLeaveReviewSourceFacade],
 exports:[DoctorLeaveReviewSourceFacade]
})
export class DoctorLeaveSourceModule{}
