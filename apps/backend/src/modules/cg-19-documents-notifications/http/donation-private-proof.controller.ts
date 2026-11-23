import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {DonationPrivateProofService} from "../application/donation-private-proof.service";
@Controller("api/v1/donations/proofs")
export class DonationPrivateProofController{
 constructor(private readonly proofs:DonationPrivateProofService){}
 @Post("initiate")
 initiate(@Headers("authorization")token:string,@Body()body:unknown){
  return this.proofs.initiate(token,body);
 }
 @Post(":proofRef/confirm")
 confirm(@Headers("authorization")token:string,@Param("proofRef")ref:string){
  return this.proofs.confirm(token,ref);
 }
 @Get("donation/:number")
 list(@Headers("authorization")token:string,@Param("number")number:string){
  return this.proofs.list(token,number);
 }
}
