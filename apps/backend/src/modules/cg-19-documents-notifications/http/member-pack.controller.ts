import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {MemberBrandService} from "../application/member-brand.service";
import {MemberPackService} from "../application/member-pack.service";

/** CG19 owns private approved brand assets and real issued membership PDFs.
 * No direct public byte routes or sample templates.
 */
@Controller("api/v1/membership/documents")
export class MemberPackController{
 constructor(private readonly brands:MemberBrandService,private readonly packs:MemberPackService){}
 @Get("config") @Header("Cache-Control","private, no-store")
 config(@Headers("authorization")token:string){return this.brands.current(token);}
 @Post("config") @Header("Cache-Control","private, no-store")
 approveConfig(@Headers("authorization")token:string,@Body()body:unknown){return this.brands.approve(token,body);}
 @Post("assets") @Header("Cache-Control","private, no-store")
 createAsset(@Headers("authorization")token:string,@Body()body:unknown){return this.brands.initiate(token,body);}
 @Get("assets/:ref") @Header("Cache-Control","private, no-store")
 asset(@Headers("authorization")token:string,@Param("ref")ref:string){return this.brands.assetStatus(token,ref);}
 @Post("assets/:ref/confirm") @Header("Cache-Control","private, no-store")
 confirmAsset(@Headers("authorization")token:string,@Param("ref")ref:string){return this.brands.confirm(token,ref);}
 @Get("me") @Header("Cache-Control","private, no-store")
 mine(@Headers("authorization")token:string){return this.packs.mine(token);}
 @Post("members/:ref/issue") @Header("Cache-Control","private, no-store")
 issue(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.packs.issue(token,ref,body);}
 @Get("packs/:ref") @Header("Cache-Control","private, no-store")
 status(@Headers("authorization")token:string,@Param("ref")ref:string){return this.packs.info(token,ref);}
 @Post("packs/:ref/reconcile") @Header("Cache-Control","private, no-store")
 reconcile(@Headers("authorization")token:string,@Param("ref")ref:string){return this.packs.reconcile(token,ref);}
 @Post("packs/:ref/revoke") @Header("Cache-Control","private, no-store")
 revoke(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.packs.revoke(token,ref,body);}
 @Get("packs/:ref/:kind/download") @Header("Cache-Control","private, no-store") @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,@Param("ref")ref:string,@Param("kind")kind:string){
  const bytes=await this.packs.download(token,ref,kind);
  return new StreamableFile(bytes,{type:"application/pdf",disposition:'attachment; filename="CareGanga-issued-member-document.pdf"'});
 }
}
@Controller("api/v1/public/membership")
export class PublicMemberVerificationController{
 constructor(private readonly packs:MemberPackService){}
 @Get("verify/:token") @Header("Cache-Control","no-store")
 verify(@Param("token")token:string){return this.packs.verify(token);}
}
