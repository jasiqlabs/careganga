import {Module} from "@nestjs/common";
import {HealthReviewSourceFacade} from "./application/health-review-source.facade";
import {HealthDoctorReviewSourceFacade} from "./application/health-doctor-review-source.facade";
import {HealthCenterContentReviewSourceFacade} from "./application/health-center-content-review-source.facade";
/** CG-14 read-only owner source adapter consumed by the EXISTING CG-03
 * review engine, without importing or duplicating CG-14's workflow module.
 */
@Module({providers:[HealthReviewSourceFacade,HealthDoctorReviewSourceFacade,HealthCenterContentReviewSourceFacade],
  exports:[HealthReviewSourceFacade,HealthDoctorReviewSourceFacade,HealthCenterContentReviewSourceFacade]})
export class HealthSourceModule{}
