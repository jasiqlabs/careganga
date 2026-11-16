import {BadRequestException,Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {BranchOperationsService} from "../application/branch-operations.service";

@Controller("api/foundation-structure/operating-branches")
export class BranchOperationsController{
  constructor(private readonly operations:BranchOperationsService){}
  private offset(value:unknown){
    if(value!==undefined&&(typeof value!=="string"||!/^(0|[1-9][0-9]{0,4})$/.test(value)))
      throw new BadRequestException("Check the requested page");
    return value?Number(value):0;
  }
  @Get()
  list(@Headers("authorization")bearer:string,@Query("offset")offset?:string,
    @Query("status")status?:string){
    return this.operations.list(bearer,this.offset(offset),status);
  }
  @Get(":branchRef")
  detail(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string){
    return this.operations.detail(bearer,branchRef);
  }
  @Patch(":branchRef")
  update(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string,
    @Body()body:unknown){
    return this.operations.update(bearer,branchRef,body);
  }
  @Patch(":branchRef/status")
  status(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string,
    @Body()body:unknown){
    return this.operations.changeStatus(bearer,branchRef,body);
  }
  @Get(":branchRef/revisions")
  history(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string,
    @Query("offset")offset?:string){
    return this.operations.revisions(bearer,branchRef,this.offset(offset));
  }
  @Get(":branchRef/departments")
  departments(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string){
    return this.operations.departments(bearer,branchRef);
  }
  @Post(":branchRef/departments")
  createDepartment(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string,
    @Body()body:unknown){return this.operations.createDepartment(bearer,branchRef,body);}
  @Patch(":branchRef/departments/:departmentRef")
  updateDepartment(@Headers("authorization")bearer:string,
    @Param("branchRef")branchRef:string,@Param("departmentRef")departmentRef:string,
    @Body()body:unknown){
    return this.operations.updateDepartment(bearer,branchRef,departmentRef,body);
  }
  @Get(":branchRef/department-links")
  links(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string){
    return this.operations.links(bearer,branchRef);
  }
  @Post(":branchRef/department-links")
  link(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string,
    @Body()body:unknown){return this.operations.link(bearer,branchRef,body);}
  @Post(":branchRef/department-links/:linkRef/end")
  unlink(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string,
    @Param("linkRef")linkRef:string,@Body()body:unknown){
    return this.operations.unlink(bearer,branchRef,linkRef,body);
  }
  @Get(":branchRef/departments/:departmentRef/participants")
  participants(@Headers("authorization")bearer:string,@Param("branchRef")branchRef:string,
    @Param("departmentRef")departmentRef:string){
    return this.operations.participants(bearer,branchRef,departmentRef);
  }
  @Post(":branchRef/departments/:departmentRef/participants")
  assignParticipant(@Headers("authorization")bearer:string,
    @Param("branchRef")branchRef:string,@Param("departmentRef")departmentRef:string,
    @Body()body:unknown){
    return this.operations.assignParticipant(bearer,branchRef,departmentRef,body);
  }
  @Post(":branchRef/departments/:departmentRef/participants/:participationRef/end")
  endParticipant(@Headers("authorization")bearer:string,
    @Param("branchRef")branchRef:string,@Param("departmentRef")departmentRef:string,
    @Param("participationRef")participationRef:string,@Body()body:unknown){
    return this.operations.endParticipant(bearer,branchRef,departmentRef,participationRef,body);
  }
}