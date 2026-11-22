import {Module} from "@nestjs/common";
import {ProjectsSourceModule} from "./projects-source.module";
import {ProjectsController} from "./http/projects.controller";
@Module({imports:[ProjectsSourceModule],controllers:[ProjectsController],exports:[ProjectsSourceModule]})
export class ProjectsFieldOperationsModule{}
