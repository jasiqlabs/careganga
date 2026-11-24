import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {ProjectsSourceModule} from "../cg-05-projects-field-operations/projects-source.module";
import {BeneficiariesService} from "./application/beneficiaries.service";

// Shared existing NestJS/PG domain owner. CG03 consumes a typed source guard;
// it must not create a second beneficiary table or own CG06 identity.
@Module({
 imports:[IdentityAccessModule,FoundationStructureModule,ProjectsSourceModule],
 providers:[BeneficiariesService],
 exports:[BeneficiariesService]
})
export class BeneficiariesSourceModule{}
