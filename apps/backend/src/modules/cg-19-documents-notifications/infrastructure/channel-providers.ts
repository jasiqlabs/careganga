import {Injectable} from "@nestjs/common";
type Channel="EMAIL"|"SMS";
export type OutboundMessage=Readonly<{
  notificationRef:string;attemptRef:string;channel:Channel;
  to:string;subject:string;body:string;
  purpose:"TRANSACTIONAL"|"PROMOTIONAL"
}>;
export type ProviderResult=Readonly<{
  state:"ACCEPTED"|"UNAVAILABLE"|"UNKNOWN"|"FAILED";
  provider:"SENDGRID"|"TWILIO";
  providerRef:string|null
}>;
const MAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const E164=/^\+[1-9]\d{7,14}$/;
function trimEnv(key:string){return process.env[key]?.trim()??"";}
/** These adapters make actual provider calls only with verified server secrets
 * and a configured sending identity. A 2xx indicates PROVIDER ACCEPTANCE,
 * never recipient delivery. UNKNOWN is not automatically sent again.
 */
@Injectable()
export class CommunicationProviders{
  configured(channel:Channel,purpose:"TRANSACTIONAL"|"PROMOTIONAL"="TRANSACTIONAL"){
    if(trimEnv("CG19_EXTERNAL_SENDING_ENABLED")!=="1")return false;
    if(purpose==="PROMOTIONAL"&&trimEnv("CG19_PROMOTIONAL_APPROVED")!=="1")
      return false;
    if(channel==="EMAIL")return Boolean(
      trimEnv("CG19_SENDGRID_API_KEY")&&
      MAIL.test(trimEnv("CG19_SENDGRID_FROM"))&&
      trimEnv("CG19_SENDGRID_VERIFIED_IDENTITY")==="1");
    return Boolean(
      trimEnv("CG19_TWILIO_ACCOUNT_SID")&&
      trimEnv("CG19_TWILIO_AUTH_TOKEN")&&
      trimEnv("CG19_TWILIO_MESSAGING_SERVICE_SID")&&
      trimEnv("CG19_TWILIO_SENDER_REGISTERED")==="1"&&
      trimEnv("CG19_TWILIO_STATUS_URL").startsWith("https://"));
  }
  async send(message:OutboundMessage):Promise<ProviderResult>{
    const provider=message.channel==="EMAIL"?"SENDGRID":"TWILIO";
    if(!this.configured(message.channel,message.purpose))
      return {state:"UNAVAILABLE",provider,providerRef:null};
    if(message.channel==="EMAIL"){
      if(!MAIL.test(message.to)||message.subject.length>120||
        message.body.length>12000)
        return {state:"FAILED",provider,providerRef:null};
      const useEu=trimEnv("CG19_SENDGRID_REGION")==="EU";
      const endpoint=useEu?"https://api.eu.sendgrid.com/v3/mail/send":
        "https://api.sendgrid.com/v3/mail/send";
      try{
        const response=await fetch(endpoint,{
          method:"POST",signal:AbortSignal.timeout(12000),
          headers:{"Authorization":"Bearer "+trimEnv("CG19_SENDGRID_API_KEY"),
            "Content-Type":"application/json"},
          body:JSON.stringify({
            from:{email:trimEnv("CG19_SENDGRID_FROM")},
            personalizations:[{to:[{email:message.to}],
              custom_args:{cg19_notification_ref:message.notificationRef,
                cg19_attempt_ref:message.attemptRef}}],
            subject:message.subject,content:[{type:"text/plain",value:message.body}],
            tracking_settings:{click_tracking:{enable:false},
              open_tracking:{enable:false}}
          })
        });
        // 202 means accepted for processing, never delivered.
        if(response.status===202){
          const key=response.headers.get("x-message-id");
          return {state:"ACCEPTED",provider,
            providerRef:key&&key.length<=160?key:null};
        }
        if(response.status===429||response.status>=500)
          return {state:"UNKNOWN",provider,providerRef:null};
        return {state:"FAILED",provider,providerRef:null};
      }catch{return {state:"UNKNOWN",provider,providerRef:null};}
    }
    if(!E164.test(message.to)||message.body.length>160||
      [...message.body].some(c=>c.charCodeAt(0)>127)&&message.body.length>70)
      return {state:"FAILED",provider,providerRef:null};
    const sid=trimEnv("CG19_TWILIO_ACCOUNT_SID"),
      token=trimEnv("CG19_TWILIO_AUTH_TOKEN");
    if(!/^AC[a-f0-9]{32}$/i.test(sid))
      return {state:"UNAVAILABLE",provider,providerRef:null};
    const callback=trimEnv("CG19_TWILIO_STATUS_URL");
    if(!/^https:\/\/[a-z0-9.-]+\/api\/communications\/provider\/twilio-status$/i.test(callback))
      return {state:"UNAVAILABLE",provider,providerRef:null};
    const body=new URLSearchParams({
      To:message.to,Body:message.body,
      MessagingServiceSid:trimEnv("CG19_TWILIO_MESSAGING_SERVICE_SID"),
      StatusCallback:callback+"?attempt="+encodeURIComponent(message.attemptRef)
    });
    try{
      const result=await fetch(
        "https://api.twilio.com/2010-04-01/Accounts/"+sid+"/Messages.json",{
          method:"POST",signal:AbortSignal.timeout(12000),
          headers:{"Authorization":"Basic "+Buffer.from(sid+":"+token).toString("base64"),
            "Content-Type":"application/x-www-form-urlencoded"},
          body:body.toString()
        });
      if(result.status===201){
        const raw=await result.json() as {sid?:unknown};
        return {state:"ACCEPTED",provider,
          providerRef:typeof raw.sid==="string"&&/^SM[a-f0-9]{32}$/i.test(raw.sid)?
            raw.sid:null};
      }
      if(result.status===429||result.status>=500)
        return {state:"UNKNOWN",provider,providerRef:null};
      return {state:"FAILED",provider,providerRef:null};
    }catch{return {state:"UNKNOWN",provider,providerRef:null};}
  }
}
