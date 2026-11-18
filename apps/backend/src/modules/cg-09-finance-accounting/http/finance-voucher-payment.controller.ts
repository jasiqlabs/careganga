import {Body,Controller,Get,Headers,Param,Post} from "@nestjs/common";
import {FinanceVoucherPaymentService} from "../application/finance-voucher-payment.service";

@Controller("api/finance-accounting/vouchers")
export class FinanceVoucherPaymentController{
 constructor(private readonly finance:FinanceVoucherPaymentService){}
 @Post(":voucherRef/request-payment")
 request(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string,
  @Body()value:unknown){
  return this.finance.requestPayment(bearer,ref,value);
 }
 @Post(":voucherRef/payment-proofs")
 submit(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string,
  @Body()value:unknown){
  return this.finance.submitProof(bearer,ref,value);
 }
 @Get(":voucherRef/payment-proofs")
 status(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string){
  return this.finance.paymentStatus(bearer,ref);
 }
 @Post(":voucherRef/payment-proofs/:proofRef/verify")
 verify(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string,
  @Param("proofRef")proofRef:string,@Body()value:unknown){
  return this.finance.verifyProof(bearer,ref,proofRef,value);
 }
 @Post(":voucherRef/post")
 post(@Headers("authorization")bearer:string,@Param("voucherRef")ref:string,
  @Body()value:unknown){
  return this.finance.post(bearer,ref,value);
 }
}
