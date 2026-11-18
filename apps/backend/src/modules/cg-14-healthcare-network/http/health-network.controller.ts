import {BadRequestException,Body,Controller,Get,Headers,Param,Patch,Post,Query} from "@nestjs/common";
import {HealthNetworkService} from "../application/health-network.service";

@Controller("api/v1/health-network")
export class HealthNetworkController{
  constructor(private readonly network:HealthNetworkService){}
  @Get("representatives/options")
  representatives(@Headers("authorization")bearer:string,@Query("search")search?:string){
    return this.network.representativeOptions(bearer,search);
  }
  @Get("providers")
  list(@Headers("authorization")bearer:string,@Query("offset")offset?:string){
    if(offset!==undefined&&!/^(0|[1-9][0-9]{0,4})$/.test(offset))
      throw new BadRequestException({code:"HEALTH_FIELD_INVALID",field:"offset"});
    return this.network.list(bearer,Number(offset??"0"));
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
