import {Body,Controller,Get,Headers,Param,Post,Query} from "@nestjs/common";
import {HrEmploymentChangeService} from "../application/hr-employment-change.service";
import {HrEmploymentChangeApprovalService} from "../../cg-03-registration-approvals/application/hr-employment-change-approval.service";
@Controller("api/hr")
export class HrEmploymentChangeController{
 constructor(private readonly changes:HrEmploymentChangeService,private readonly reviews:HrEmploymentChangeApprovalService){}
 @Get("employment-changes") list(@Headers("authorization") t:string,@Query("offset") offset?:string){return this.changes.list(t,offset);}
 @Get("employment-change-options/employees") employees(@Headers("authorization") t:string,@Query("search") search?:string){return this.changes.employees(t,search);}
 @Get("employment-change-options/branches") branches(@Headers("authorization") t:string){return this.changes.branches(t);}
 @Get("employment-change-options/destination") destination(@Headers("authorization") t:string,@Query("branchRef") branch:string){return this.changes.destination(t,branch);}
 @Get("employment-change-options/roles") roles(@Headers("authorization") t:string,@Query("search") search?:string){return this.changes.roleOptions(t,search);}
 @Get("employment-changes/:ref") detail(@Headers("authorization") t:string,@Param("ref") ref:string){return this.changes.detail(t,ref);}
 @Post("employment-changes") create(@Headers("authorization") t:string,@Body() body:unknown){return this.changes.create(t,body);}
 @Post("employment-changes/:ref/edit") edit(@Headers("authorization") t:string,@Param("ref") ref:string,@Body() body:unknown){return this.changes.edit(t,ref,body);}
 @Post("employment-changes/:ref/submit") submit(@Headers("authorization") t:string,@Param("ref") ref:string,@Body() body:unknown){return this.changes.submit(t,ref,body);}
 @Post("employment-changes/:ref/withdraw") withdraw(@Headers("authorization") t:string,@Param("ref") ref:string,@Body() body:unknown){return this.changes.withdraw(t,ref,body);}
 @Post("employment-changes/:ref/clearance") clearance(@Headers("authorization") t:string,@Param("ref") ref:string,@Body() body:unknown){return this.changes.clearance(t,ref,body);}
 @Get("me/changes") mine(@Headers("authorization") t:string){return this.changes.mine(t);}
 @Get("me/changes/:ref") own(@Headers("authorization") t:string,@Param("ref") ref:string){return this.changes.ownDetail(t,ref);}
 @Get("employment-change-reviews") inbox(@Headers("authorization") t:string,@Query("offset") offset?:string,@Query("status") status?:string){return this.reviews.inbox(t,offset,status);}
 @Get("employment-change-reviews/:ref") review(@Headers("authorization") t:string,@Param("ref") ref:string){return this.reviews.detail(t,ref);}
 @Post("employment-change-reviews/:ref/decide") decide(@Headers("authorization") t:string,@Param("ref") ref:string,@Body() body:unknown){return this.reviews.decide(t,ref,body);}
 @Post("employment-change-reviews/:ref/apply") apply(@Headers("authorization") t:string,@Param("ref") ref:string){return this.reviews.applyNow(t,ref);}
}
