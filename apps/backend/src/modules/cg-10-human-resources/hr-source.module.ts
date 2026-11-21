import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {HrEnrollmentSourceFacade} from "./application/hr-enrollment-source.facade";
/** Narrow owner contract to CG03 and original CG19: no CG10 HR DB writes elsewhere. */
@Module({imports:[IdentityAccessModule],providers:[HrEnrollmentSourceFacade],
 exports:[HrEnrollmentSourceFacade]})
export class HrSourceModule{}
