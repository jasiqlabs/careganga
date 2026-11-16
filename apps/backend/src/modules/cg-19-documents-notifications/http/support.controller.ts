import {BadRequestException,Body,Controller,ForbiddenException,Get,Headers,Param,Patch,Post,Query,Req} from "@nestjs/common";
import {createHmac,timingSafeEqual} from "node:crypto";
import {SupportService} from "../application/support.service";

type GuestRequest={socket?:{remoteAddress?:string};ip?:string};
function peer(req:GuestRequest,client:unknown,ts:unknown,signature:unknown,
  route:"contact"|"status"){
  const secret=Buffer.from(process.env.CG19_GUEST_PROXY_KEY??"","base64");
  // Direct/local development uses socket IP. In production the explicit
  // trusted reverse-proxy proof prevents all visitors sharing one web IP bucket.
  if(secret.length===0)return req.socket?.remoteAddress??req.ip??"unresolved";
  if(secret.length!==32||typeof client!=="string"||typeof ts!=="string"||
    typeof signature!=="string"||!/^[0-9a-fA-F:.]{3,45}$/.test(client)||
    !/^\d{13}$/.test(ts)||Math.abs(Date.now()-Number(ts))>60000||
    !/^[a-f0-9]{64}$/i.test(signature))
    throw new ForbiddenException("Trusted support proxy unavailable");
  const expected=createHmac("sha256",secret)
    .update(route+":"+ts+":"+client).digest();
  if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))
    throw new ForbiddenException("Trusted support proxy unavailable");
  return client;
}

@Controller("api/support")
export class SupportController{
  constructor(private readonly support:SupportService){}
  @Post("public/contact")
  contact(@Req()req:GuestRequest,@Body()body:unknown,
    @Headers("x-cg19-proxy-client")ip?:string,
    @Headers("x-cg19-proxy-ts")ts?:string,
    @Headers("x-cg19-proxy-proof")proof?:string){
    return this.support.contact(peer(req,ip,ts,proof,"contact"),body);
  }
  @Post("receipt/status")
  receipt(@Req()req:GuestRequest,@Body()body:unknown,
    @Headers("x-cg19-proxy-client")ip?:string,
    @Headers("x-cg19-proxy-ts")ts?:string,
    @Headers("x-cg19-proxy-proof")proof?:string){
    return this.support.receipt(peer(req,ip,ts,proof,"status"),body);
  }
  @Get("public/faqs")
  publicFaqs(){return this.support.publicFaqs();}
  @Get("cases")
  cases(@Headers("authorization")token:string,
    @Query("limit")limit?:string,@Query("filter")filter?:string,
    @Query("cursor")cursor?:string){
    return this.support.cases(token,limit??30,filter??"ALL",cursor);
  }
  /** Private full-source search remains body-only: raw contact words never
   * appear in URLs, access logs, browser history or referrers. */
  @Post("cases/search")
  search(@Headers("authorization")token:string,@Body()body:unknown){
    if(!body||typeof body!=="object"||Array.isArray(body))
      throw new BadRequestException("Check support search");
    const x=body as Record<string,unknown>;
    if(Object.keys(x).some(k=>!["limit","filter","cursor","search"].includes(k)))
      throw new BadRequestException("Unsupported search information");
    return this.support.cases(token,x.limit??30,x.filter??"ALL",x.cursor??null,
      x.search??"");
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
