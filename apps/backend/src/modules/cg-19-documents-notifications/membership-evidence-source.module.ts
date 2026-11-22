import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider} from "./infrastructure/private-storage-provider.factory";
import {MembershipEvidenceService} from "./application/membership-evidence.service";
import {MembershipEvidenceController} from "./http/membership-evidence.controller";
import {VolunteerEvidenceService} from "./application/volunteer-evidence.service";
import {VolunteerEvidenceController} from "./http/volunteer-evidence.controller";
import {MemberBrandService} from "./application/member-brand.service";
import {MemberPackService} from "./application/member-pack.service";
import {VolunteerCardService} from "./application/volunteer-card.service";
import {VolunteerCardController,PublicVolunteerVerificationController} from "./http/volunteer-card.controller";
import {MemberPackController,PublicMemberVerificationController} from "./http/member-pack.controller";
@Module({imports:[DatabaseModule,IdentityAccessModule],providers:[MembershipEvidenceService,VolunteerEvidenceService,MemberBrandService,MemberPackService,VolunteerCardService,{provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],controllers:[MembershipEvidenceController,VolunteerEvidenceController,MemberPackController,PublicMemberVerificationController,VolunteerCardController,PublicVolunteerVerificationController],exports:[MembershipEvidenceService,VolunteerEvidenceService,MemberBrandService,MemberPackService,VolunteerCardService]})
export class MembershipEvidenceSourceModule{}
