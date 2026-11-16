import { Module } from "@nestjs/common";
import { IdentityAccessModule } from "../cg-01-identity-access/identity-access.module";
import { FoundationStructureService } from "./application/foundation-structure.service";
import { FoundationStructureController } from "./http/foundation-structure.controller";
import { BranchRegistrationDraftService } from "./application/branch-registration-draft.service";
import { BranchRegistrationDraftController } from "./http/branch-registration-draft.controller";
import { BranchSourceFacade } from "./application/branch-source.facade";

@Module({
  imports:[IdentityAccessModule],
  providers:[FoundationStructureService,BranchRegistrationDraftService,BranchSourceFacade],
  controllers:[FoundationStructureController,BranchRegistrationDraftController],
  exports:[FoundationStructureService,BranchRegistrationDraftService,BranchSourceFacade]
})
export class FoundationStructureModule {}
