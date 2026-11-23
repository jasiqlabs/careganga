import {Body,Controller,Get,Headers,Param,Post,StreamableFile} from "@nestjs/common";
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
 @Post(":proofRef/download")
 async download(@Headers("authorization")auth:string,@Param("proofRef")proofRef:string){
  const result=await this.proofs.download(auth,proofRef);
  return new StreamableFile(result.bytes,{type:result.mime,
   disposition:'attachment; filename="CareGanga-Private-Donor-Proof"'});
 }
 @Get("donation/:number")
 list(@Headers("authorization")token:string,@Param("number")number:string){
  return this.proofs.list(token,number);
 }
}
