import {Body,Controller,Get,Headers,Patch} from "@nestjs/common";
import {SafeErrorMessagesService} from "../application/safe-error-messages.service";

/** CG-21 owns safe copy only; no editing validation or auth conditions. */
@Controller("api/platform-configuration-audit/error-messages")
export class SafeErrorMessagesController{
 constructor(private readonly service:SafeErrorMessagesService){}
 @Get()
 list(@Headers("authorization")bearer:string){return this.service.list(bearer);}
 @Patch()
 update(@Headers("authorization")bearer:string,@Body()body:unknown){
  return this.service.update(bearer,body);
 }
}
