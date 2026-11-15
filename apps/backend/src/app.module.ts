import { Module } from "@nestjs/common";
import { DatabaseModule } from "./core/infrastructure/database.module";
import { HealthController } from "./core/http/health.controller";
import { IdentityAccessModule } from "./modules/cg-01-identity-access/identity-access.module";
import { PlatformConfigurationModule } from "./modules/cg-21-platform-configuration-audit/platform-configuration.module";
import { FoundationStructureModule } from "./modules/cg-02-foundation-structure/foundation-structure.module";

@Module({ imports: [DatabaseModule, IdentityAccessModule, PlatformConfigurationModule, FoundationStructureModule], controllers: [HealthController] })
export class AppModule {}
