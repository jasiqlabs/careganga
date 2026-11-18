import {Controller,Get,Header,Headers} from "@nestjs/common";
import {CmsPublicNoticeSource} from "../application/cms-public-notice-source.service";
/** Read-only source picker. No public GET on original operational notices. */
@Controller("api/cms")
export class CmsPublicNoticeSourceController{
 constructor(private readonly source:CmsPublicNoticeSource){}
 @Get("notice-sources")
 @Header("Cache-Control","private, no-store")
 candidates(@Headers("authorization")bearer:string){
  return this.source.candidates(bearer);
 }
}
