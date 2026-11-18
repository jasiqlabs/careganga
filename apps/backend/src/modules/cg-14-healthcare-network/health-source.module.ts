import {Module} from "@nestjs/common";
import {HealthReviewSourceFacade} from "./application/health-review-source.facade";
/** CG-14 read-only owner source adapter consumed by the EXISTING CG-03
 * review engine, without importing or duplicating CG-14's workflow module.
 */
@Module({providers:[HealthReviewSourceFacade],exports:[HealthReviewSourceFacade]})
export class HealthSourceModule{}
