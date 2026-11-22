import {Body,Controller,Get,Header,Headers,Param,Post} from "@nestjs/common";
import {MembershipActivationService} from "../application/membership-activation.service";
@Controller("api/v1/membership")
export class MembershipActivationController{
 constructor(private readonly activation:MembershipActivationService){}
 @Get("me") @Header("Cache-Control","private, no-store") me(@Headers("authorization")token:string){return this.activation.me(token);}
 @Get("me/history") @Header("Cache-Control","private, no-store") history(@Headers("authorization")token:string){return this.activation.history(token);}
 @Get("applications/:ref/fee") @Header("Cache-Control","private, no-store") fee(@Headers("authorization")token:string,@Param("ref")ref:string){return this.activation.fee(token,ref);}
 @Post("applications/:ref/activate") @Header("Cache-Control","private, no-store") activate(@Headers("authorization")token:string,@Param("ref")ref:string,@Body()body:unknown){return this.activation.activate(token,ref,body);}
}
