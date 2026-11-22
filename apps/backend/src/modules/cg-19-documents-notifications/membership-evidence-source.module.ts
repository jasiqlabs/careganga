import {Module} from "@nestjs/common";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider} from "./infrastructure/private-storage-provider.factory";
import {MembershipEvidenceService} from "./application/membership-evidence.service";
import {MembershipEvidenceController} from "./http/membership-evidence.controller";
import {MemberBrandService} from "./application/member-brand.service";
import {MemberPackService} from "./application/member-pack.service";
import {MemberPackController,PublicMemberVerificationController} from "./http/member-pack.controller";
@Module({imports:[DatabaseModule,IdentityAccessModule],providers:[MembershipEvidenceService,MemberBrandService,MemberPackService,{provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],controllers:[MembershipEvidenceController,MemberPackController,PublicMemberVerificationController],exports:[MembershipEvidenceService,MemberBrandService,MemberPackService]})
export class MembershipEvidenceSourceModule{}
