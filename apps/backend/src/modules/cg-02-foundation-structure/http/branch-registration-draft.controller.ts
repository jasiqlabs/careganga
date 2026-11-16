import {BadRequestException,Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {BranchRegistrationDraftService} from "../application/branch-registration-draft.service";

/** Draft routes only. Submit, approval, document upload and activation are
 * deliberately absent until the genuine CG-03/CG-19 owner adapters exist.
 */
@Controller("api/foundation-structure/branches")
export class BranchRegistrationDraftController{
  constructor(private readonly drafts:BranchRegistrationDraftService){}
  @Get("drafts")
  list(@Headers("authorization")bearer:string,@Query("offset")offset?:string){
    if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset))
      throw new BadRequestException("Check the branch page");
    return this.drafts.list(bearer,offset?Number(offset):0);
  }
  @Post("drafts")
  create(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.drafts.create(bearer,body);
  }
  @Get("drafts/:registrationRef")
  detail(@Headers("authorization")bearer:string,@Param("registrationRef")ref:string){
    return this.drafts.detail(bearer,ref);
  }
  @Patch("drafts/:registrationRef")
  save(@Headers("authorization")bearer:string,@Param("registrationRef")ref:string,
    @Body()body:unknown){
    return this.drafts.save(bearer,ref,body);
  }
  @Get("changes/:action/:requestKey")
  lookup(@Headers("authorization")bearer:string,@Param("action")action:string,
    @Param("requestKey")key:string){
    return this.drafts.lookup(bearer,action,key);
  }
}
