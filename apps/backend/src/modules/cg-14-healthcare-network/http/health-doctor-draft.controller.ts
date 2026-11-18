import {
  BadRequestException,Body,Controller,Get,Headers,Param,Patch,Post,Query
} from "@nestjs/common";
import {HealthDoctorDraftService} from "../application/health-doctor-draft.service";
import {HealthDoctorReviewWorkflowService} from "../application/health-doctor-review-workflow.service";

@Controller("api/v1/health-network/doctors")
export class HealthDoctorDraftController{
  constructor(private readonly doctors:HealthDoctorDraftService,
    private readonly reviews:HealthDoctorReviewWorkflowService){}
  @Get()
  list(@Headers("authorization")bearer:string,@Query("offset")offset?:string){
    if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset))
      throw new BadRequestException({code:"HEALTH_DOCTOR_FIELD_INVALID",field:"offset"});
    return this.doctors.list(bearer,Number(offset??0));
  }
  @Post()
  create(@Headers("authorization")bearer:string,@Body()body:unknown){
    return this.doctors.create(bearer,body);
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
  @Post(":doctorRef/centers")
  proposeCenter(@Headers("authorization")bearer:string,
    @Param("doctorRef")ref:string,@Body()body:unknown){
    return this.doctors.proposeCenter(bearer,ref,body);
  }
}
