import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {DocumentsNotificationsModule} from "../cg-19-documents-notifications/documents-notifications.module";
import {HealthNetworkService} from "./application/health-network.service";
import {HealthNetworkController} from "./http/health-network.controller";

@Module({
  imports:[IdentityAccessModule,DocumentsNotificationsModule],
  providers:[HealthNetworkService],
  controllers:[HealthNetworkController],
  exports:[HealthNetworkService]
})
export class HealthNetworkModule{}
