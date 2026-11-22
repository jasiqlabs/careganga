import {Module} from "@nestjs/common";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {MembershipTiersService} from "./application/membership-tiers.service";
import {MembershipTiersController,PublicMembershipTiersController} from "./http/membership-tiers.controller";
@Module({imports:[DatabaseModule,IdentityAccessModule],providers:[MembershipTiersService],controllers:[MembershipTiersController,PublicMembershipTiersController],exports:[MembershipTiersService]})
export class MembershipVolunteersModule{}
