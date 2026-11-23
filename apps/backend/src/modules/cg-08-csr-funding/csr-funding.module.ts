import {Module} from "@nestjs/common";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {CsrPartnersService} from "./application/csr-partners.service";
import {CsrPartnersController} from "./http/csr-partners.controller";
@Module({imports:[DatabaseModule,IdentityAccessModule,FoundationStructureModule],
 providers:[CsrPartnersService],controllers:[CsrPartnersController],exports:[CsrPartnersService]})
export class CsrFundingModule{}
