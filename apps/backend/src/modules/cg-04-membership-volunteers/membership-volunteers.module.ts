import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {Module} from "@nestjs/common";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {MembershipApplicationsService} from "./application/membership-applications.service";
import {MembershipApplicationsController} from "./http/membership-applications.controller";
import {MembershipTiersService} from "./application/membership-tiers.service";
import {MembershipTiersController,PublicMembershipTiersController} from "./http/membership-tiers.controller";
@Module({imports:[DatabaseModule,IdentityAccessModule,FoundationStructureModule,RegistrationApprovalsModule],providers:[MembershipTiersService,MembershipApplicationsService],controllers:[MembershipTiersController,PublicMembershipTiersController,MembershipApplicationsController],exports:[MembershipTiersService]})
export class MembershipVolunteersModule{}
