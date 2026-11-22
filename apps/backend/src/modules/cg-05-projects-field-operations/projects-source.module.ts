import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {OperationsSummaryService} from "./application/operations-summary.service";
import {FieldVisitsService} from "./application/field-visits.service";
import {ProjectActivitiesService} from "./application/project-activities.service";
import {ProjectTasksService} from "./application/project-tasks.service";
import {ProjectsService} from "./application/projects.service";
@Module({imports:[IdentityAccessModule,FoundationStructureModule],providers:[ProjectsService,ProjectTasksService,ProjectActivitiesService,FieldVisitsService,OperationsSummaryService],exports:[ProjectsService,ProjectTasksService,ProjectActivitiesService,FieldVisitsService,OperationsSummaryService]})
export class ProjectsSourceModule{}
