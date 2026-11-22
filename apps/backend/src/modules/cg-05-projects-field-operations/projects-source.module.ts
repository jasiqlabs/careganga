import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {ProjectsService} from "./application/projects.service";
@Module({imports:[IdentityAccessModule,FoundationStructureModule],providers:[ProjectsService],exports:[ProjectsService]})
export class ProjectsSourceModule{}
