import { Module } from "@nestjs/common";
import { IdentityAccessModule } from "../cg-01-identity-access/identity-access.module";
import { FoundationStructureService } from "./application/foundation-structure.service";
import { FoundationStructureController } from "./http/foundation-structure.controller";
import { BranchRegistrationDraftService } from "./application/branch-registration-draft.service";
import { BranchRegistrationDraftController } from "./http/branch-registration-draft.controller";
import { BranchSourceFacade } from "./application/branch-source.facade";
import { BranchLifecycleService } from "./application/branch-lifecycle.service";

@Module({
  imports:[IdentityAccessModule],
  providers:[FoundationStructureService,BranchRegistrationDraftService,BranchSourceFacade,BranchLifecycleService],
  controllers:[FoundationStructureController,BranchRegistrationDraftController],
  exports:[FoundationStructureService,BranchRegistrationDraftService,BranchSourceFacade,BranchLifecycleService]
})
export class FoundationStructureModule {}
