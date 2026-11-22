import {Module} from "@nestjs/common";
import {ProjectsSourceModule} from "./projects-source.module";
import {ProjectActivitiesController} from "./http/project-activities.controller";
import {ProjectTasksController} from "./http/project-tasks.controller";
import {ProjectsController} from "./http/projects.controller";
@Module({imports:[ProjectsSourceModule],controllers:[ProjectsController,ProjectTasksController,ProjectActivitiesController],exports:[ProjectsSourceModule]})
export class ProjectsFieldOperationsModule{}
