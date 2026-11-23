import {Module} from "@nestjs/common";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {CsrFundingModule} from "../cg-08-csr-funding/csr-funding.module";
import {PrivateObjectStorage} from "./infrastructure/private-object-storage";
import {makePrivateStorageProvider} from "./infrastructure/private-storage-provider.factory";
import {CsrAgreementEvidenceService} from "./application/csr-agreement-evidence.service";
@Module({imports:[DatabaseModule,IdentityAccessModule,CsrFundingModule],
 providers:[CsrAgreementEvidenceService,{provide:PrivateObjectStorage,useFactory:makePrivateStorageProvider}],
 exports:[CsrAgreementEvidenceService]})
export class CsrAgreementSourceModule{}
