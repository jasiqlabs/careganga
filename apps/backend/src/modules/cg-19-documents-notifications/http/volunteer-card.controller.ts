import {Body,Controller,Get,Header,Headers,Param,Post,StreamableFile} from "@nestjs/common";
import {VolunteerCardService} from "../application/volunteer-card.service";
/** CG19 alone issues approved two-sided volunteer cards and protects original PDF bytes. */
@Controller("api/v1/volunteers/documents")
export class VolunteerCardController {
 constructor(private readonly cards:VolunteerCardService){}
 @Get("me") @Header("Cache-Control","private, no-store")
 mine(@Headers("authorization")token:string){return this.cards.mine(token);}
 @Get("volunteers/:ref") @Header("Cache-Control","private, no-store")
 volunteerStatus(@Headers("authorization")token:string,@Param("ref")ref:string){return this.cards.status(token,ref);}
 @Post("volunteers/:ref/issue") @Header("Cache-Control","private, no-store")
 issue(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.cards.issue(token,ref,body);}
 @Get("cards/:ref") @Header("Cache-Control","private, no-store")
 info(@Headers("authorization")token:string,@Param("ref")ref:string){return this.cards.info(token,ref);}
 @Post("cards/:ref/reconcile") @Header("Cache-Control","private, no-store")
 reconcile(@Headers("authorization")token:string,@Param("ref")ref:string){return this.cards.reconcile(token,ref);}
 @Post("cards/:ref/revoke") @Header("Cache-Control","private, no-store")
 revoke(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.cards.revoke(token,ref,body);}
 @Get("cards/:ref/download") @Header("Cache-Control","private, no-store") @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")token:string,@Param("ref")ref:string){
  const bytes=await this.cards.download(token,ref);
  return new StreamableFile(bytes,{type:"application/pdf",disposition:'attachment; filename="CareGanga-issued-volunteer-card.pdf"'});
 }
}
@Controller("api/v1/public/volunteers")
export class PublicVolunteerVerificationController{
 constructor(private readonly cards:VolunteerCardService){}
 @Get("verify/:code") @Header("Cache-Control","no-store")
 verify(@Param("code")code:string){return this.cards.verify(code);}
}
