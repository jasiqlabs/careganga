import {Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {CampaignDraftsService} from "../application/campaign-drafts.service";
/** Original A12–A15: authenticated draft only, never a donation or publication route. */
@Controller("api/v1/campaigns")
export class CampaignDraftsController{
 constructor(private readonly campaigns:CampaignDraftsService){}
 @Get() list(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){return this.campaigns.list(token,query);}
 @Get("options") options(@Headers("authorization")token:string,@Query()query:Record<string,unknown>){return this.campaigns.options(token,query);}
 @Post() create(@Headers("authorization")token:string,@Body()body:unknown){return this.campaigns.create(token,body);}
 @Get(":ref") detail(@Headers("authorization")token:string,@Param("ref")ref:string){return this.campaigns.detail(token,ref);}
 @Patch(":ref/draft") save(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.campaigns.save(token,ref,body);}
}
