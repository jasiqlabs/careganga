import { Module } from "@nestjs/common";
import { DatabaseModule } from "./core/infrastructure/database.module";
import { HealthController } from "./core/http/health.controller";
import { IdentityAccessModule } from "./modules/cg-01-identity-access/identity-access.module";
import { PlatformConfigurationModule } from "./modules/cg-21-platform-configuration-audit/platform-configuration.module";

@Module({ imports: [DatabaseModule, IdentityAccessModule, PlatformConfigurationModule], controllers: [HealthController] })
export class AppModule {}
