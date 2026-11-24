import {verifyPayrollReadback} from "../../cg-09-finance-accounting/infrastructure/payroll-razorpayx-readback";
type ChannelCheck=Readonly<{
  result:"CHECK_ACCEPTED"|"CHECK_FAILED"|"ADAPTER_UNAVAILABLE";
  reason:"SENDER_CONFIRMED"|"SERVICE_CONFIRMED"|"MERCHANT_CONFIRMED"|
    "NO_MATCHING_SECRET"|"UNAVAILABLE"|"UNSUPPORTED"
}>;
const disabled:ChannelCheck={result:"ADAPTER_UNAVAILABLE",reason:"UNAVAILABLE"};
/** CG-21 owns only explicit, on-demand integration readiness and its secret
 * pointer. CG-19 owns sending, content, recipients and provider delivery.
 * Here an HTTPS provider read validates existence of the configured sender.
 * Never send a test message or assert a successful delivery.
 */
export async function checkCommunicationReadiness(
  provider:string,purpose:string,reference:string,root?:string):Promise<ChannelCheck>{
  if(provider==="razorpayx"&&purpose==="payroll")return root&&await verifyPayrollReadback(reference,root)?{result:"CHECK_ACCEPTED",reason:"MERCHANT_CONFIRMED"}:{result:"ADAPTER_UNAVAILABLE",reason:"UNAVAILABLE"};
  if(provider==="sendgrid"&&purpose==="email"){
    const configured=process.env.CG19_SENDGRID_SECRET_REF?.trim()??"";
    const key=process.env.CG19_SENDGRID_API_KEY?.trim()??"";
    const from=process.env.CG19_SENDGRID_FROM?.trim().toLowerCase()??"";
    if(!configured||configured!==reference||key.length<20||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from))
      return {result:"ADAPTER_UNAVAILABLE",reason:"NO_MATCHING_SECRET"};
    const origin=process.env.CG19_SENDGRID_REGION==="EU"?
      "https://api.eu.sendgrid.com":"https://api.sendgrid.com";
    try{
      const response=await fetch(origin+"/v3/verified_senders?limit=100",{
        method:"GET",signal:AbortSignal.timeout(8000),
        headers:{Authorization:"Bearer "+key},cache:"no-store"
      });
      if(!response.ok)return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};
      const payload:unknown=await response.json();
      if(!payload||typeof payload!=="object"||
        !("results" in payload)||!Array.isArray(payload.results))
        return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};
      const verified=payload.results.some((item:unknown)=>{
        if(!item||typeof item!=="object"||! ( "from_email" in item ) ||
          !("verified" in item))return false;
        return item.verified===true&&
          typeof item.from_email==="string"&&
          item.from_email.toLowerCase()===from;
      });
      return verified?{result:"CHECK_ACCEPTED",reason:"SENDER_CONFIRMED"}:
        {result:"CHECK_FAILED",reason:"UNAVAILABLE"};
    }catch{return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};}
  }
  if(provider==="twilio"&&purpose==="sms"){
    const configured=process.env.CG19_TWILIO_SECRET_REF?.trim()??"";
    const sid=process.env.CG19_TWILIO_ACCOUNT_SID?.trim()??"";
    const token=process.env.CG19_TWILIO_AUTH_TOKEN?.trim()??"";
    const service=process.env.CG19_TWILIO_MESSAGING_SERVICE_SID?.trim()??"";
    if(!configured||configured!==reference||
      !/^AC[a-f0-9]{32}$/i.test(sid)||
      !/^MG[a-f0-9]{32}$/i.test(service)||token.length<20||
      process.env.CG19_TWILIO_SENDER_REGISTERED!=="1")
      return {result:"ADAPTER_UNAVAILABLE",reason:"NO_MATCHING_SECRET"};
    try{
      const response=await fetch(
        "https://messaging.twilio.com/v1/Services/"+service,{
          method:"GET",signal:AbortSignal.timeout(8000),
          headers:{Authorization:"Basic "+
            Buffer.from(sid+":"+token).toString("base64")},cache:"no-store"
        });
      if(!response.ok)return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};
      const reply:unknown=await response.json();
      if(!reply||typeof reply!=="object"||!("sid" in reply)||
        reply.sid!==service)return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};
      // Existence of a Messaging Service is not carrier/recipient delivery proof.
      // Registration approval is an explicitly configured deployment gate.
      return {result:"CHECK_ACCEPTED",reason:"SERVICE_CONFIRMED"};
    }catch{return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};}
  }
  if(provider==="razorpay"&&purpose==="donations"){
    // CG21 checks actual merchant credentials, not a local checkbox.
    // The secret store pointer must match the deployment's protected key pair.
    const ref=process.env.CG07_RAZORPAY_SECRET_REF?.trim()??"";
    const id=process.env.CG07_RAZORPAY_KEY_ID?.trim()??"";
    const key=process.env.CG07_RAZORPAY_KEY_SECRET?.trim()??"";
    const webhook=process.env.CG07_RAZORPAY_WEBHOOK_SECRET?.trim()??"";
    if(!ref||reference!==ref||!/^rzp_(live|test)_[A-Za-z0-9]{8,}$/.test(id)||
      key.length<16||webhook.length<16||
      (process.env.NODE_ENV==="production"&&!id.startsWith("rzp_live_")))
      return {result:"ADAPTER_UNAVAILABLE",reason:"NO_MATCHING_SECRET"};
    try{
      const result=await fetch("https://api.razorpay.com/v1/payment_links?count=1",{
       headers:{Authorization:"Basic "+Buffer.from(id+":"+key).toString("base64")},
       cache:"no-store",signal:AbortSignal.timeout(8000)});
      if(!result.ok)return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};
      const body:unknown=await result.json();
      if(!body||typeof body!=="object"||!("items" in body)||
        !Array.isArray(body.items))
       return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};
      return {result:"CHECK_ACCEPTED",reason:"MERCHANT_CONFIRMED"};
    }catch{return {result:"CHECK_FAILED",reason:"UNAVAILABLE"};}
  }
  return {result:"ADAPTER_UNAVAILABLE",reason:"UNSUPPORTED"};
}
