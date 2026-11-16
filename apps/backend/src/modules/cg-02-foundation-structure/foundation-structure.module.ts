import { Module } from "@nestjs/common";
import { IdentityAccessModule } from "../cg-01-identity-access/identity-access.module";
import { FoundationStructureService } from "./application/foundation-structure.service";
import { FoundationStructureController } from "./http/foundation-structure.controller";
import { BranchRegistrationDraftService } from "./application/branch-registration-draft.service";
import { BranchRegistrationDraftController } from "./http/branch-registration-draft.controller";

@Module({
  imports:[IdentityAccessModule],
  providers:[FoundationStructureService,BranchRegistrationDraftService],
  controllers:[FoundationStructureController,BranchRegistrationDraftController],
  exports:[FoundationStructureService]
})
export class FoundationStructureModule {}
