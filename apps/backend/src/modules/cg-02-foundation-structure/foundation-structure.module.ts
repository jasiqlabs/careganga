import { Module } from "@nestjs/common";
import { IdentityAccessModule } from "../cg-01-identity-access/identity-access.module";
import { FoundationStructureService } from "./application/foundation-structure.service";
import { FoundationStructureController } from "./http/foundation-structure.controller";
import { BranchRegistrationDraftService } from "./application/branch-registration-draft.service";
import { BranchRegistrationDraftController } from "./http/branch-registration-draft.controller";
import { BranchSourceFacade } from "./application/branch-source.facade";
import { BranchLifecycleService } from "./application/branch-lifecycle.service";
import { BranchOperationsService } from "./application/branch-operations.service";
import { BranchOperationsController } from "./http/branch-operations.controller";

@Module({
  imports:[IdentityAccessModule],
  providers:[FoundationStructureService,BranchRegistrationDraftService,BranchSourceFacade,BranchLifecycleService,BranchOperationsService],
  controllers:[FoundationStructureController,BranchRegistrationDraftController,BranchOperationsController],
  exports:[FoundationStructureService,BranchRegistrationDraftService,BranchSourceFacade,BranchLifecycleService,BranchOperationsService]
})
export class FoundationStructureModule {}
