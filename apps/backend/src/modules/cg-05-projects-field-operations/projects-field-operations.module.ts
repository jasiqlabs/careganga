import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {ProjectsService} from "./application/projects.service";
import {ProjectsController} from "./http/projects.controller";
@Module({imports:[IdentityAccessModule,FoundationStructureModule],providers:[ProjectsService],controllers:[ProjectsController],exports:[ProjectsService]})
export class ProjectsFieldOperationsModule{}
