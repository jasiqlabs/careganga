import {
  Body,Controller,Get,Header,Headers,Param,Post,StreamableFile
} from "@nestjs/common";
import {PrivateLetterService} from "../application/private-letter.service";

@Controller("api/documents/letters")
export class PrivateLetterController{
  constructor(private readonly letters:PrivateLetterService){}
  @Get("template")
  template(@Headers("authorization")bearer:string){
    return this.letters.activeTemplate(bearer);
  }
  @Post("template/approve")
  approve(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.letters.approveTemplate(bearer,body);
  }
  @Get("case/:caseRef")
  list(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
    return this.letters.list(bearer,ref);
  }
  @Post("issue")
  issue(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.letters.issue(bearer,body);
  }
  @Post(":documentRef/reconcile")
  reconcile(@Headers("authorization")bearer:string,
    @Param("documentRef")ref:string){
    return this.letters.reconcile(bearer,ref);
  }
  @Post(":documentRef/revoke")
  revoke(@Headers("authorization")bearer:string,
    @Param("documentRef")ref:string,@Body()body:unknown){
    return this.letters.revoke(bearer,ref,body);
  }
  @Get(":documentRef/download")
  @Header("Cache-Control","private, no-store")
  @Header("X-Content-Type-Options","nosniff")
  async download(@Headers("authorization")bearer:string,
    @Param("documentRef")ref:string){
    const bytes=await this.letters.download(bearer,ref);
    return new StreamableFile(bytes,{type:"application/pdf",
      disposition:'attachment; filename="Private-access-confirmation.pdf"'});
  }
}
