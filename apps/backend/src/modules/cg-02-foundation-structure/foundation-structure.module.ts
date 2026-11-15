import { Module } from "@nestjs/common";
import { IdentityAccessModule } from "../cg-01-identity-access/identity-access.module";
import { FoundationStructureService } from "./application/foundation-structure.service";
import { FoundationStructureController } from "./http/foundation-structure.controller";

@Module({
  imports:[IdentityAccessModule],
  providers:[FoundationStructureService],
  controllers:[FoundationStructureController],
  exports:[FoundationStructureService]
})
export class FoundationStructureModule {}
