import {Module} from "@nestjs/common";
import {CmsReviewSourceFacade} from "./application/cms-review-source.facade";
/** Read-only CG18 source adapter to prevent NestJS cycle with CG03 approval. */
@Module({providers:[CmsReviewSourceFacade],exports:[CmsReviewSourceFacade]})
export class CmsSourceModule {}
