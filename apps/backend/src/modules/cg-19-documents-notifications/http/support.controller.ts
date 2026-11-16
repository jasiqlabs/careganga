import {Body,Controller,Get,Headers,Param,Patch,Post,Query,Req} from "@nestjs/common";
import {SupportService} from "../application/support.service";

type GuestRequest={socket?:{remoteAddress?:string};ip?:string};
const peer=(req:GuestRequest)=>req.socket?.remoteAddress??req.ip??"unresolved";

@Controller("api/support")
export class SupportController{
  constructor(private readonly support:SupportService){}
  @Post("public/contact")
  contact(@Req()req:GuestRequest,@Body()body:unknown){
    return this.support.contact(peer(req),body);
  }
  @Post("receipt/status")
  receipt(@Req()req:GuestRequest,@Body()body:unknown){
    return this.support.receipt(peer(req),body);
  }
  @Get("public/faqs")
  publicFaqs(){return this.support.publicFaqs();}
  @Get("cases")
  cases(@Headers("authorization")token:string,
    @Query("limit")limit?:string,@Query("filter")filter?:string){
    return this.support.cases(token,limit??30,filter??"ALL");
  }
  @Get("cases/:caseRef")
  detail(@Headers("authorization")token:string,
    @Param("caseRef")ref:string){return this.support.detail(token,ref);}
  @Post("cases/:caseRef/read")
  read(@Headers("authorization")token:string,
    @Param("caseRef")ref:string){return this.support.read(token,ref);}
  @Post("cases/:caseRef/archive")
  archive(@Headers("authorization")token:string,
    @Param("caseRef")ref:string,@Body()body:unknown){
    return this.support.archive(token,ref,body);
  }
  @Post("cases/:caseRef/assign")
  assign(@Headers("authorization")token:string,
    @Param("caseRef")ref:string,@Body()body:unknown){
    return this.support.assign(token,ref,body);
  }
  @Post("cases/:caseRef/reply")
  reply(@Headers("authorization")token:string,
    @Param("caseRef")ref:string,@Body()body:unknown){
    return this.support.reply(token,ref,body);
  }
  @Patch("cases/:caseRef/status")
  status(@Headers("authorization")token:string,
    @Param("caseRef")ref:string,@Body()body:unknown){
    return this.support.change(token,ref,body);
  }
  @Get("faqs")
  faqs(@Headers("authorization")token:string){
    return this.support.faqs(token);
  }
  @Post("faqs")
  faqCreate(@Headers("authorization")token:string,@Body()body:unknown){
    return this.support.faqCreate(token,body);
  }
  @Patch("faqs/:faqRef")
  faqUpdate(@Headers("authorization")token:string,
    @Param("faqRef")ref:string,@Body()body:unknown){
    return this.support.faqChange(token,ref,body);
  }
}
