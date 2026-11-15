import { Module } from "@nestjs/common";
import { SessionService } from "./application/session.service";
import { SessionController } from "./http/session.controller";
import { RecoveryController } from "./http/recovery.controller";
import { RecoveryService } from "./application/recovery.service";
import { RecoveryDelivery } from "./infrastructure/recovery-delivery";
import { SessionGuard } from "./http/session.guard";

@Module({
  controllers:[SessionController,RecoveryController],
  providers:[SessionService,SessionGuard,RecoveryService,RecoveryDelivery],
  exports:[SessionService]
})
export class IdentityAccessModule {}
