import {Module} from "@nestjs/common";
import {OperationsSummaryController} from "./http/operations-summary.controller";
import {ProjectsSourceModule} from "./projects-source.module";
import {FieldVisitsController} from "./http/field-visits.controller";
import {ProjectActivitiesController} from "./http/project-activities.controller";
import {ProjectTasksController} from "./http/project-tasks.controller";
import {ProjectsController} from "./http/projects.controller";
@Module({imports:[ProjectsSourceModule],controllers:[ProjectsController,ProjectTasksController,ProjectActivitiesController,FieldVisitsController,OperationsSummaryController],exports:[ProjectsSourceModule]})
export class ProjectsFieldOperationsModule{}
