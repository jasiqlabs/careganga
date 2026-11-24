import {Module} from "@nestjs/common";
import {DatabaseModule} from "../../core/infrastructure/database.module";
import {IdentityAccessModule} from "../cg-01-identity-access/identity-access.module";
import {FoundationStructureModule} from "../cg-02-foundation-structure/foundation-structure.module";
import {FinanceSourceModule} from "../cg-09-finance-accounting/finance-source.module";
import {CsrPartnersService} from "./application/csr-partners.service";
import {CsrPartnerPublicSource} from "./application/csr-partner-public-source";
import {CsrPartnersController} from "./http/csr-partners.controller";
import {CsrFundingProposalsService} from "./application/csr-funding-proposals.service";
import {CsrFundingProposalsController} from "./http/csr-funding-proposals.controller";
import {CsrFundingReportsService} from "./application/csr-funding-reports.service";
import {CsrFundingReportsController} from "./http/csr-funding-reports.controller";
@Module({imports:[DatabaseModule,IdentityAccessModule,FoundationStructureModule,FinanceSourceModule],
 providers:[CsrPartnersService,CsrPartnerPublicSource,CsrFundingProposalsService,CsrFundingReportsService],controllers:[CsrPartnersController,CsrFundingProposalsController,CsrFundingReportsController],exports:[CsrFundingReportsService,CsrPartnersService,CsrPartnerPublicSource,CsrFundingProposalsService]})
export class CsrFundingModule{}
