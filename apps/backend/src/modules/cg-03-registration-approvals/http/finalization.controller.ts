import {Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {ApprovalFinalizationService} from "../application/finalization.service";

@Controller("api/registration-approvals")
export class ApprovalFinalizationController{
  constructor(private readonly finalizer:ApprovalFinalizationService){}
  @Get("cases/:caseRef/owner-status")
  status(@Headers("authorization") bearer:string,
    @Param("caseRef") caseRef:string){
    return this.finalizer.status(bearer,caseRef);
  }
  @Post("cases/:caseRef/retry-owner")
  retry(@Headers("authorization") bearer:string,
    @Param("caseRef") caseRef:string){
    return this.finalizer.retry(bearer,caseRef);
  }
}
