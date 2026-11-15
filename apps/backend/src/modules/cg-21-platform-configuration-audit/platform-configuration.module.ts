import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {PlatformSettingsService} from "./application/platform-settings.service";
import {PlatformSettingsController} from "./http/platform-settings.controller";
import {PlatformAuditController} from "./http/platform-audit.controller";
import {RecoveryController} from "./http/recovery.controller";
import {PlatformAuditService} from "./application/platform-audit.service";
import {RecoveryService} from "./application/recovery.service";
import {RecoveryFacility,UnavailableRecoveryFacility} from "./infrastructure/recovery-facility";

@Module({
  imports:[IdentityAccessModule],
  controllers:[PlatformSettingsController,PlatformAuditController,RecoveryController],
  providers:[
    PlatformSettingsService,PlatformAuditService,RecoveryService,
    UnavailableRecoveryFacility,
    {provide:RecoveryFacility,useExisting:UnavailableRecoveryFacility}
  ],
  exports:[PlatformSettingsService,PlatformAuditService]
})
export class PlatformConfigurationModule {}
