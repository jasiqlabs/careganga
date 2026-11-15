import { Module } from "@nestjs/common";
import { DatabaseModule } from "./core/infrastructure/database.module";
import { HealthController } from "./core/http/health.controller";
import { IdentityAccessModule } from "./modules/cg-01-identity-access/identity-access.module";
import { PlatformConfigurationModule } from "./modules/cg-21-platform-configuration-audit/platform-configuration.module";
import { RegistrationApprovalsModule } from "./modules/cg-03-registration-approvals/registration-approvals.module";

@Module({ imports: [DatabaseModule, IdentityAccessModule, PlatformConfigurationModule, RegistrationApprovalsModule], controllers: [HealthController] })
export class AppModule {}
