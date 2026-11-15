import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {PlatformSettingsService} from "./application/platform-settings.service";
import {PlatformSettingsController} from "./http/platform-settings.controller";

@Module({
  imports:[IdentityAccessModule],
  controllers:[PlatformSettingsController],
  providers:[PlatformSettingsService],
  exports:[PlatformSettingsService]
})
export class PlatformConfigurationModule {}
