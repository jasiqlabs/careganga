import {
  BadRequestException,Body,Controller,Get,Headers,Param,Patch,Post,Query
} from "@nestjs/common";
import {HealthDoctorDraftService} from "../application/health-doctor-draft.service";
import {HealthDoctorFeesService} from "../application/health-doctor-fees.service";
import {HealthDoctorReviewWorkflowService} from "../application/health-doctor-review-workflow.service";

@Controller("api/v1/health-network/doctors")
export class HealthDoctorDraftController{
  constructor(private readonly doctors:HealthDoctorDraftService,
    private readonly reviews:HealthDoctorReviewWorkflowService,
    private readonly fees:HealthDoctorFeesService){}
  @Get()
  list(@Headers("authorization")bearer:string,@Query("offset")offset?:string,
    @Query("q")search?:string,@Query("status")status?:string){
    if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset))
      throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"offset"});
    if(search!==undefined&&(search.length>80||/[\u0000-\u001f\u007f]/.test(search)))
      throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"search"});
    return this.doctors.list(bearer,Number(offset??0),search??"",status??"");
  }
  @Post()
  create(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.doctors.create(bearer,body);
  }
  @Get("eligible-centers")
  eligibleCenters(@Headers("authorization")bearer:string,@Query("q")q?:string){
    return this.doctors.eligibleCenters(bearer,q??"");
  }
  @Get(":doctorRef")
  detail(@Headers("authorization")bearer:string,@Param("doctorRef")ref:string){
    return this.doctors.detail(bearer,ref);
  }
  @Patch(":doctorRef")
  update(@Headers("authorization")bearer:string,@Param("doctorRef")ref:string,
    @Body()body:unknown){
    return this.doctors.update(bearer,ref,body);
  }
  @Post(":doctorRef/suspend")
  suspendDoctor(@Headers("authorization")bearer:string,
    @Param("doctorRef")ref:string,@Body()body:unknown){
    return this.doctors.suspendDoctor(bearer,ref,body);
  }
  @Post(":doctorRef/submit")
  submit(@Headers("authorization")bearer:string,@Param("doctorRef")ref:string,
    @Body()body:unknown){
    return this.reviews.submit(bearer,ref,body);
  }
  @Post("reviews/:caseRef/apply")
  apply(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
    return this.reviews.apply(bearer,ref);
  }
  @Post("reviews/:caseRef/return-to-draft")
  returnDraft(@Headers("authorization")bearer:string,@Param("caseRef")ref:string){
    return this.reviews.returnToDraft(bearer,ref);
  }
  @Get(":doctorRef/centers")
  centers(@Headers("authorization")bearer:string,@Param("doctorRef")ref:string){
    return this.doctors.centers(bearer,ref);
  }
  @Post(":doctorRef/centers/:associationRef/approve")
  approveCenter(@Headers("authorization")bearer:string,
    @Param("doctorRef")doctorRef:string,@Param("associationRef")associationRef:string,
    @Body()body:unknown){
    return this.doctors.approveCenter(bearer,doctorRef,associationRef,body);
  }
  @Post(":doctorRef/centers/:associationRef/suspend")
  suspendCenter(@Headers("authorization")bearer:string,
    @Param("doctorRef")doctorRef:string,@Param("associationRef")associationRef:string,
    @Body()body:unknown){
    return this.doctors.suspendCenter(bearer,doctorRef,associationRef,body);
  }
  @Get(":doctorRef/centers/:associationRef/fees")
  feesForCenter(@Headers("authorization")bearer:string,
    @Param("doctorRef")doctorRef:string,@Param("associationRef")associationRef:string){
    return this.fees.list(bearer,doctorRef,associationRef);
  }
  @Post(":doctorRef/centers/:associationRef/fees")
  proposeFee(@Headers("authorization")bearer:string,
    @Param("doctorRef")doctorRef:string,@Param("associationRef")associationRef:string,
    @Body()body:unknown){
    return this.fees.propose(bearer,doctorRef,associationRef,body);
  }
  @Post(":doctorRef/centers/:associationRef/fees/:feeRef/approve")
  approveFee(@Headers("authorization")bearer:string,
    @Param("doctorRef")doctorRef:string,@Param("associationRef")associationRef:string,
    @Param("feeRef")feeRef:string,@Body()body:unknown){
    return this.fees.approve(bearer,doctorRef,associationRef,feeRef,body);
  }
  @Post(":doctorRef/centers")
  proposeCenter(@Headers("authorization")bearer:string,
    @Param("doctorRef")ref:string,@Body()body:unknown){
    return this.doctors.proposeCenter(bearer,ref,body);
  }
}
