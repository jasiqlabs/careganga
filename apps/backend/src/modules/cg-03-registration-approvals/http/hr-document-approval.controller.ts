import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HrDocumentApprovalService} from "../application/hr-document-approval.service";
@Controller("api/hr")
export class HrDocumentApprovalController{
 constructor(private readonly approvals:HrDocumentApprovalService){}
 @Get("document-subjects") subjects(@Headers("authorization")t:string,@Query("kind")kind:string,@Query("search")search?:string){return this.approvals.subjects(t,kind,search);}
 @Post("document-requests") create(@Headers("authorization")t:string,@Body()body:unknown){return this.approvals.create(t,body);}
 @Post("document-requests/:ref/submit") submit(@Headers("authorization")t:string,@Param("ref")ref:string,@Body()body:unknown){return this.approvals.submit(t,ref,body);}
 @Get("document-reviews") inbox(@Headers("authorization")t:string,@Query("offset")offset?:string){return this.approvals.inbox(t,offset);}
 @Get("document-reviews/:id") detail(@Headers("authorization")t:string,@Param("id")id:string){return this.approvals.detail(t,id);}
 @Post("document-reviews/:id/decide") decide(@Headers("authorization")t:string,@Param("id")id:string,@Body()body:unknown){return this.approvals.decide(t,id,body);}
}
