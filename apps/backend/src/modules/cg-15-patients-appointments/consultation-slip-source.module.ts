import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {ConsultationSlipSourceFacade} from "./application/consultation-slip-source.facade";
/** CG-19 consumes only this CG-15 original read source. No circular import. */
@Module({
 imports:[IdentityAccessModule],
 providers:[ConsultationSlipSourceFacade],
 exports:[ConsultationSlipSourceFacade]
})
export class ConsultationSlipSourceModule{}
