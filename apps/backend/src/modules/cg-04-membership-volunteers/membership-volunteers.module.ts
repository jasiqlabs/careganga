import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {MembershipActivationService} from "./application/membership-activation.service";
import {MembershipActivationController} from "./http/membership-activation.controller";
import {VolunteerApplicationsService} from "./application/volunteer-applications.service";
import {VolunteerRosterService} from "./application/volunteer-roster.service";
import {VolunteerRosterController} from "./http/volunteer-roster.controller";
import {VolunteerActivationService} from "./application/volunteer-activation.service";
import {VolunteerActivationController} from "./http/volunteer-activation.controller";
import {VolunteerApplicationsController} from "./http/volunteer-applications.controller";
import {RegistrationApprovalsModule} from "../cg-03-registration-approvals/registration-approvals.module";
import {Module} from "@nestjs/common";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {MembershipApplicationsService} from "./application/membership-applications.service";
import {MembershipApplicationsController} from "./http/membership-applications.controller";
import {MembershipRosterService} from "./application/membership-roster.service";
import {MembershipRosterController} from "./http/membership-roster.controller";
import {MembershipTiersService} from "./application/membership-tiers.service";
import {MembershipTiersController,PublicMembershipTiersController} from "./http/membership-tiers.controller";
@Module({imports:[DatabaseModule,IdentityAccessModule,FoundationStructureModule,RegistrationApprovalsModule,FinanceSourceModule],providers:[MembershipRosterService,MembershipTiersService,MembershipApplicationsService,MembershipActivationService,VolunteerApplicationsService,VolunteerActivationService,VolunteerRosterService],controllers:[MembershipRosterController,MembershipTiersController,PublicMembershipTiersController,MembershipApplicationsController,MembershipActivationController,VolunteerApplicationsController,VolunteerActivationController,VolunteerRosterController],exports:[MembershipTiersService,MembershipRosterService,VolunteerRosterService]})
export class MembershipVolunteersModule{}
