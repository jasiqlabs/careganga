import { BadRequestException, Body, Controller, Get, Headers, Param, Patch, Post, Query } from "@nestjs/common";
import { FoundationStructureService } from "../application/foundation-structure.service";

@Controller("api/foundation-structure")
export class FoundationStructureController {
  constructor(private readonly service:FoundationStructureService){}
  @Get("profile")
  profile(@Headers("authorization") bearer:string){return this.service.profile(bearer);}
  @Patch("profile")
  saveProfile(@Headers("authorization") bearer:string,@Body() body:unknown){
    return this.service.saveProfile(bearer,body as Parameters<FoundationStructureService["saveProfile"]>[1]);
  }
  @Get("geography")
  areas(@Headers("authorization") bearer:string,@Query("level") level?:string,
    @Query("parent") parent?:string,@Query("search") search?:string){
    return this.service.areas(bearer,level,parent,search??"");
  }
  @Post("geography")
  createArea(@Headers("authorization") bearer:string,@Body() body:unknown){
    return this.service.createArea(bearer,body as Parameters<FoundationStructureService["createArea"]>[1]);
  }
  @Patch("geography/:areaRef")
  updateArea(@Headers("authorization") bearer:string,@Param("areaRef") areaRef:string,@Body() body:unknown){
    return this.service.updateArea(bearer,areaRef,body as Parameters<FoundationStructureService["updateArea"]>[2]);
  }
  @Get("departments")
  departments(@Headers("authorization") bearer:string,@Query("search") search?:string,@Query("kind") kind?:string){
    if(search!==undefined&&typeof search!=="string"||kind!==undefined&&typeof kind!=="string")
      throw new BadRequestException("Check department filters");
    return this.service.departments(bearer,search??"",kind);
  }
  @Post("departments")
  createDepartment(@Headers("authorization") bearer:string,@Body() body:unknown){
    return this.service.createDepartment(bearer,body as Parameters<FoundationStructureService["createDepartment"]>[1]);
  }
  @Patch("departments/:departmentRef")
  updateDepartment(@Headers("authorization") bearer:string,@Param("departmentRef") ref:string,@Body() body:unknown){
    return this.service.updateDepartment(bearer,ref,body as Parameters<FoundationStructureService["updateDepartment"]>[2]);
  }
  @Get("officeholders/options")
  officeholderOptions(@Headers("authorization") bearer:string,@Query("search") search?:string){
    return this.service.officeholderOptions(bearer,search??"");
  }
  @Get("departments/:departmentRef/participants")
  participants(@Headers("authorization") bearer:string,@Param("departmentRef") ref:string){
    return this.service.participants(bearer,ref);
  }
  @Post("departments/:departmentRef/participants")
  addParticipant(@Headers("authorization") bearer:string,@Param("departmentRef") ref:string,@Body() body:unknown){
    return this.service.addParticipant(bearer,ref,body as Parameters<FoundationStructureService["addParticipant"]>[2]);
  }
}