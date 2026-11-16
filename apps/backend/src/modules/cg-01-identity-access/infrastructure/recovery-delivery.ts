import { Injectable } from "@nestjs/common";
import { createTransport } from "nodemailer";

/** Credential-reset OTP delivery (SMTP or SMS only); no invites or routine-login OTP. Never log secrets. */
@Injectable()
export class RecoveryDelivery {
  isConfigured(): boolean {
    return Boolean(
      process.env.AUTH_SMTP_HOST &&
      process.env.AUTH_SMTP_USER &&
      process.env.AUTH_SMTP_PASSWORD &&
      process.env.AUTH_EMAIL_FROM
    );
  }
  isOtpChannelConfigured(channel:"email"|"sms"):boolean {
    if(channel==="email")return this.isConfigured();
    return Boolean(/^AC[0-9a-f]{32}$/i.test(process.env.AUTH_SMS_TWILIO_ACCOUNT_SID??"") &&
      (process.env.AUTH_SMS_TWILIO_AUTH_TOKEN??"").length>=20 &&
      /^\+[1-9][0-9]{7,14}$/.test(process.env.AUTH_SMS_TWILIO_FROM??""));
  }
  async sendOtp(to:string,channel:"email"|"sms",code:string):
    Promise<"PROVIDER_ACCEPTED"|"UNKNOWN"|"UNAVAILABLE"> {
    if(!/^\d{6}$/.test(code)||!this.isOtpChannelConfigured(channel))return "UNAVAILABLE";
    if(channel==="email")
      return this.send(to,"CareGanga password reset code",
        "Your CareGanga password reset code is "+code+
        ". It expires in 10 minutes. Do not share it. Ignore this if you did not request it.");
    const sid=process.env.AUTH_SMS_TWILIO_ACCOUNT_SID??"";
    const token=process.env.AUTH_SMS_TWILIO_AUTH_TOKEN??"";
    const from=process.env.AUTH_SMS_TWILIO_FROM??"";
    if(!/^\+[1-9][0-9]{7,14}$/.test(to))return "UNAVAILABLE";
    const params=new URLSearchParams({To:to,From:from,
      Body:"CareGanga password reset OTP: "+code+". Expires in 10 minutes. Never share this code."});
    try{
      const result=await fetch("https://api.twilio.com/2010-04-01/Accounts/"+sid+"/Messages.json",{
        method:"POST",headers:{"Authorization":"Basic "+
          Buffer.from(sid+":"+token).toString("base64"),
          "Content-Type":"application/x-www-form-urlencoded"},
        body:params.toString(),signal:AbortSignal.timeout(8000)
      });
      return result.ok?"PROVIDER_ACCEPTED":result.status>=500?"UNKNOWN":"UNAVAILABLE";
    }catch{return "UNKNOWN";}
  }

  private async send(to:string,subject:string,text:string):Promise<"PROVIDER_ACCEPTED"|"UNKNOWN"|"UNAVAILABLE">{
    if (!this.isConfigured()) return "UNAVAILABLE";
    const transport=createTransport({
      host:process.env.AUTH_SMTP_HOST,
      port:465,
      secure:true,
      auth:{user:process.env.AUTH_SMTP_USER,pass:process.env.AUTH_SMTP_PASSWORD},
      connectionTimeout:5000,greetingTimeout:5000,socketTimeout:7000,pool:false,
      tls:{minVersion:"TLSv1.2",rejectUnauthorized:true}
    });
    try {
      await transport.sendMail({from:process.env.AUTH_EMAIL_FROM,to,subject,text});
      return "PROVIDER_ACCEPTED";
    } catch {
      return "UNKNOWN";
    } finally {
      transport.close();
    }
  }
}
