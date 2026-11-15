import { Module } from "@nestjs/common";
import { SessionService } from "./application/session.service";
import { SessionController } from "./http/session.controller";

@Module({
  controllers:[SessionController],
  providers:[SessionService],
  exports:[SessionService]
})
export class IdentityAccessModule {}
