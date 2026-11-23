import {Controller,Get,Header,Param,StreamableFile} from "@nestjs/common";
import {CampaignPublicMediaService} from "../application/campaign-public-media.service";

/** Anonymous bytes are allowed only while CG07 + CG03 + CG18 + CG19
 * sources remain current. Browser/CDN caches must not resurrect revoked media.
 */
@Controller("api/public/campaigns")
export class CampaignPublicMediaController{
 constructor(private readonly media:CampaignPublicMediaService){}
 @Get("media/:ref")
 @Header("Cache-Control","no-store, no-cache, must-revalidate")
 @Header("X-Content-Type-Options","nosniff")
 @Header("X-Robots-Tag","noimageindex")
 async image(@Param("ref")ref:string){
  const original=await this.media.current(ref);
  return new StreamableFile(original.bytes,{type:original.mime,disposition:"inline"});
 }
}
