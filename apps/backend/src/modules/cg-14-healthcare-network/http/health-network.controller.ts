import {BadRequestException,Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {HealthNetworkService} from "../application/health-network.service";
import {HealthDoctorFeesService} from "../application/health-doctor-fees.service";
import {HealthDoctorDraftService} from "../application/health-doctor-draft.service";
import {HealthReviewWorkflowService} from "../application/health-review-workflow.service";

@Controller("api/v1/health-network")
export class HealthNetworkController{
  constructor(private readonly network:HealthNetworkService,
    private readonly reviews:HealthReviewWorkflowService,
    private readonly fees:HealthDoctorFeesService,
    private readonly doctors:HealthDoctorDraftService){}
  @Get("representatives/options")
  representatives(@Headers("authorization")bearer:string,@Query("search")search?:string){
    return this.network.representativeOptions(bearer,search);
  }
  @Get("providers")
  list(@Headers("authorization")bearer:string,@Query("offset")offset?:string,
    @Query("status")status?:string,@Query("q")search?:string){
    if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset)||
      !["ALL","PENDING","SUBMITTED","RETURNED","REJECTED","VERIFIED","SUSPENDED"]
        .includes(status??"ALL")||
      search!==undefined&&(search.length>80||/[\u0000-\u001f\u007f]/.test(search)))
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"search"});
    return this.network.list(bearer,Number(offset??"0"),status??"ALL",search??"");
  }
  @Post("providers")
  createProvider(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.network.createProvider(bearer,body);
  }
  @Patch("providers/:providerRef")
  updateProvider(@Headers("authorization")bearer:string,
    @Param("providerRef")ref:string,@Body()body:unknown){
    return this.network.updateProvider(bearer,ref,body);
  }
  @Get("providers/:providerRef")
  provider(@Headers("authorization")bearer:string,@Param("providerRef")ref:string){
    return this.network.provider(bearer,ref);
  }
  @Post("providers/:providerRef/suspend")
  suspendProvider(@Headers("authorization")bearer:string,
    @Param("providerRef")ref:string,@Body()body:unknown){
    return this.reviews.suspendProvider(bearer,ref,body);
  }
  @Post("centers/:centerRef/suspend")
  suspendCenter(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,@Body()body:unknown){
    return this.reviews.suspendCenter(bearer,ref,body);
  }
  @Post("providers/:providerRef/reopen")
  reopenProvider(@Headers("authorization")bearer:string,
    @Param("providerRef")ref:string,@Body()body:unknown){
    return this.reviews.reopenProvider(bearer,ref,body);
  }
  @Post("centers/:centerRef/reopen")
  reopenCenter(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,@Body()body:unknown){
    return this.reviews.reopenCenter(bearer,ref,body);
  }
  @Post("providers/:providerRef/submit")
  submitProvider(@Headers("authorization")bearer:string,@Param("providerRef")ref:string,
    @Body()body:unknown){
    return this.reviews.submitProvider(bearer,ref,body);
  }
  @Post("providers/reviews/:caseRef/apply")
  applyProvider(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
    return this.reviews.apply(bearer,ref,"HEALTH_PROVIDER_VERIFICATION");
  }
  @Post("providers/reviews/:caseRef/return-to-draft")
  returnProvider(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
    return this.reviews.resumeReturned(bearer,ref,"HEALTH_PROVIDER_VERIFICATION");
  }
  @Post("centers/:centerRef/submit")
  submitCenter(@Headers("authorization")bearer:string,@Param("centerRef")ref:string,
    @Body()body:unknown){
    return this.reviews.submitCenter(bearer,ref,body,false);
  }
  @Post("my-centers/:centerRef/submit")
  submitMyCenter(@Headers("authorization")bearer:string,@Param("centerRef")ref:string,
    @Body()body:unknown){
    return this.reviews.submitCenter(bearer,ref,body,true);
  }
  @Post("centers/reviews/:caseRef/apply")
  applyCenter(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
    return this.reviews.apply(bearer,ref,"HEALTH_CENTER_VERIFICATION");
  }
  @Post("centers/reviews/:caseRef/return-to-draft")
  returnCenter(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
    return this.reviews.resumeReturned(bearer,ref,"HEALTH_CENTER_VERIFICATION");
  }
  @Post("centers/:centerRef/access")
  updateAccess(@Headers("authorization")bearer:string,@Param("centerRef")ref:string,
    @Body()body:unknown){
    return this.reviews.access(bearer,ref,body);
  }
  @Post("centers/:centerRef/publication")
  publication(@Headers("authorization")bearer:string,@Param("centerRef")ref:string,
    @Body()body:unknown){
    return this.reviews.publish(bearer,ref,body);
  }
  @Get("providers/:providerRef/finance-reference")
  financeReference(@Headers("authorization")bearer:string,@Param("providerRef")ref:string){
    return this.network.financeReference(bearer,ref);
  }
  @Post("providers/:providerRef/finance-reference")
  saveFinanceReference(@Headers("authorization")bearer:string,
    @Param("providerRef")ref:string,@Body()body:unknown){
    return this.network.saveFinanceReference(bearer,ref,body);
  }
  @Post("providers/:providerRef/centers")
  addCenter(@Headers("authorization")bearer:string,
    @Param("providerRef")ref:string,@Body()body:unknown){
    return this.network.createCenter(bearer,ref,body);
  }
  @Get("centers/:centerRef")
  center(@Headers("authorization")bearer:string,@Param("centerRef")ref:string){
    return this.network.centerDraft(bearer,ref);
  }
  @Patch("centers/:centerRef")
  updateCenter(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,@Body()body:unknown){
    return this.network.updateCenter(bearer,ref,body,false);
  }
  @Post("centers/:centerRef/representatives")
  affiliate(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,@Body()body:unknown){
    return this.network.affiliate(bearer,ref,body);
  }
  @Get("centers/:centerRef/representatives")
  representativesOfCenter(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string){
    return this.network.centerRepresentatives(bearer,ref);
  }
  @Post("centers/:centerRef/representatives/:affiliationRef/revoke")
  revokeRepresentative(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,
    @Param("affiliationRef")affiliationRef:string,@Body()body:unknown){
    return this.network.revokeRepresentative(bearer,ref,affiliationRef,body);
  }
  @Get("my-centers/:centerRef/eligible-doctors")
  ownEligibleDoctors(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,@Query("q")q?:string){
    return this.doctors.ownEligibleDoctors(bearer,ref,q??"");
  }
  @Post("my-centers/:centerRef/doctors")
  proposeOwnDoctor(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,@Body()body:unknown){
    return this.doctors.proposeOwnCenter(bearer,ref,body);
  }
  @Get("my-centers/:centerRef/doctors")
  ownDoctors(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string){
    return this.fees.ownDoctors(bearer,ref);
  }
  @Get("my-centers/:centerRef/doctors/:doctorRef/associations/:associationRef/fees")
  ownFees(@Headers("authorization")bearer:string,
    @Param("centerRef")center:string,@Param("doctorRef")doctor:string,
    @Param("associationRef")association:string){
    return this.fees.ownFees(bearer,center,doctor,association);
  }
  @Post("my-centers/:centerRef/doctors/:doctorRef/associations/:associationRef/fees")
  ownFeeProposal(@Headers("authorization")bearer:string,
    @Param("centerRef")center:string,@Param("doctorRef")doctor:string,
    @Param("associationRef")association:string,@Body()body:unknown){
    return this.fees.proposeForOwnCenter(bearer,center,doctor,association,body);
  }
  @Get("my-centers")
  myCenters(@Headers("authorization")bearer:string){
    return this.network.myCenters(bearer);
  }
  @Get("my-centers/:centerRef")
  myCenter(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string){
    return this.network.centerDraft(bearer,ref,true);
  }
  @Patch("my-centers/:centerRef")
  updateOwnCenter(@Headers("authorization")bearer:string,
    @Param("centerRef")ref:string,@Body()body:unknown){
    return this.network.updateCenter(bearer,ref,body,true);
  }
  @Get("geography")
  geography(@Headers("authorization")bearer:string,
    @Query("level")level?:string,@Query("parentRef")parentRef?:string){
    return this.network.geo(bearer,level??"STATE",parentRef);
  }
}
