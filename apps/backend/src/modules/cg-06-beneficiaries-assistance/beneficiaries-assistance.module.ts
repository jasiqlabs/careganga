import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {ProjectsSourceModule} from "../cg-05-projects-field-operations/projects-source.module";
import {BeneficiariesService} from "./application/beneficiaries.service";
import {BeneficiariesController} from "./http/beneficiaries.controller";

@Module({
 imports:[IdentityAccessModule,FoundationStructureModule,ProjectsSourceModule],
 providers:[BeneficiariesService],
 controllers:[BeneficiariesController],
 exports:[BeneficiariesService]
})
export class BeneficiariesAssistanceModule{}
