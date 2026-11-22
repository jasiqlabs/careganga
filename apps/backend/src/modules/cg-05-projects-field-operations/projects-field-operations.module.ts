import {Module} from "@nestjs/common";
import {ProjectsSourceModule} from "./projects-source.module";
import {ProjectTasksController} from "./http/project-tasks.controller";
import {ProjectsController} from "./http/projects.controller";
@Module({imports:[ProjectsSourceModule],controllers:[ProjectsController,ProjectTasksController],exports:[ProjectsSourceModule]})
export class ProjectsFieldOperationsModule{}
