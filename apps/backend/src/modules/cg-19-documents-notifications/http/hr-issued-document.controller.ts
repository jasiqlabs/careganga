import {BadRequestException,Body,Controller,Get,Header,Headers,Param,Post,Query,Req,StreamableFile} from "@nestjs/common";
import {HrIssuedDocumentService} from "../application/hr-issued-document.service";
import {HealthPublicRequestThrottleService} from "../../cg-14-healthcare-network/application/health-public-request-throttle.service";
@Controller("api/hr")
@Header("Cache-Control","private, no-store")
export class HrIssuedDocumentController{
 constructor(private readonly documents:HrIssuedDocumentService){}
 @Get("document-requests") list(@Headers("authorization")t:string,@Query("offset")offset?:string){return this.documents.list(t,false,offset);}
 @Get("document-templates") templates(@Headers("authorization")t:string){return this.documents.templates(t);}
 @Post("document-templates/approve") template(@Headers("authorization")t:string,@Body()body:unknown){return this.documents.approveTemplate(t,body);}
 @Post("document-requests/:ref/issue") issue(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()body:unknown){return this.documents.issue(t,ref,body);}
 @Post("issued-documents/:id/dispatch") dispatch(@Headers("authorization")t:string,@Param("id")id:string,@Body()body:unknown){return this.documents.dispatch(t,id,body);}
 @Post("me/documents/:id/acknowledge") acknowledge(@Headers("authorization")t:string,@Param("id")id:string){return this.documents.acknowledge(t,id);}
 @Post("me/documents/:id/receipt-uploads") receiptUpload(@Headers("authorization")t:string,@Param("id")id:string,@Body()body:unknown){return this.documents.initiateReceipt(t,id,body);}
 @Get("me/documents/:id/receipt-uploads/:upload") receiptStatus(@Headers("authorization")t:string,@Param("id")id:string,@Param("upload")upload:string){return this.documents.receiptStatus(t,id,upload);}
 @Post("me/documents/:id/receipt-uploads/:upload/confirm") receiptConfirm(@Headers("authorization")t:string,@Param("id")id:string,@Param("upload")upload:string){return this.documents.confirmReceipt(t,id,upload);}
 @Post("issued-documents/:id/reconcile") reconcile(@Headers("authorization")t:string,@Param("id")id:string){return this.documents.reconcile(t,id);}
 @Post("issued-documents/:id/revoke") revoke(@Headers("authorization")t:string,@Param("id")id:string,@Body()body:unknown){return this.documents.revoke(t,id,body);}
 @Get("issued-documents/:id/file")
 @Header("X-Content-Type-Options","nosniff")
 async download(@Headers("authorization")t:string,@Param("id")id:string){return new StreamableFile(await this.documents.download(t,id),{type:"application/pdf",disposition:'attachment; filename="CareGanga-employee-document.pdf"'});}
 @Get("issued-documents/:id/receipt-file")
 @Header("X-Content-Type-Options","nosniff")
 async receivedCopy(@Headers("authorization")t:string,@Param("id")id:string){const f=await this.documents.downloadReceipt(t,id,false);return new StreamableFile(f.bytes,{type:f.mime,disposition:'attachment; filename="CareGanga-received-copy.'+(f.mime==="application/pdf"?"pdf":f.mime==="image/png"?"png":"jpg")+'"' });}
 @Get("me/documents/:id/receipt-file")
 @Header("X-Content-Type-Options","nosniff")
 async ownReceivedCopy(@Headers("authorization")t:string,@Param("id")id:string){const f=await this.documents.downloadReceipt(t,id,true);return new StreamableFile(f.bytes,{type:f.mime,disposition:'attachment; filename="CareGanga-received-copy.'+(f.mime==="application/pdf"?"pdf":f.mime==="image/png"?"png":"jpg")+'"' });}
 @Get("me/documents") mine(@Headers("authorization")t:string,@Query("offset")offset?:string){return this.documents.list(t,true,offset);}
 @Get("me/documents/:id/file")
 @Header("X-Content-Type-Options","nosniff")
 async ownFile(@Headers("authorization")t:string,@Param("id")id:string){return new StreamableFile(await this.documents.download(t,id,true),{type:"application/pdf",disposition:'attachment; filename="CareGanga-employee-document.pdf"'});}
}
@Controller("api/v1/employee-cards")
export class HrEmployeeCardVerifierController{
 constructor(private readonly documents:HrIssuedDocumentService,private readonly throttle:HealthPublicRequestThrottleService){}
 @Post("verify")
 @Header("Cache-Control","no-store")
 @Header("X-Robots-Tag","noindex, nofollow")
 async verify(@Req()request:object,@Body()raw:unknown){
  await this.throttle.hit(request,"slip");
  if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).length!==1||!("token" in raw))throw new BadRequestException("Check the opaque verification token");
  return this.documents.verifyPublic(raw.token);
 }
}
