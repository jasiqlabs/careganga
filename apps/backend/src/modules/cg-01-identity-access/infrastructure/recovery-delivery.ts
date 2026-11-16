import { Injectable } from "@nestjs/common";
import { createTransport } from "nodemailer";

/** Credential-only, user-triggered SMTP delivery. Never batch-scan identities or log secret material. */
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
  /** Only a committed user-triggered invite is sent; no scheduled scans or broad messaging ledger. */
  async submitInvitation(to:string, token:string):Promise<"PROVIDER_ACCEPTED"|"UNKNOWN"|"UNAVAILABLE">{
    return this.send(to,"CareGanga Foundation staff invitation",
      "You have been invited to use the CareGanga Foundation internal staff portal.\n"+
      "Open the legitimate CareGanga app or website yourself and use the invitation flow.\n"+
      "Invitation code: "+token+"\n\nThis invitation expires in 24 hours.\n"+
      "Only share the code with the account owner. Contact Foundation support if unexpected.");
  }
  async submit(to: string, token: string): Promise<"PROVIDER_ACCEPTED" | "UNKNOWN" | "UNAVAILABLE"> {
    return this.send(to,"CareGanga Foundation account recovery",
      "A recovery request was made for your CareGanga account.\n" +
      "Enter the recovery code in your original CareGanga app together with your authenticator code.\n\n"+
      "Recovery code: "+token+"\n\nExpires in 15 minutes.\n"+
      "If you did not request this, do not share this code.\n");
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
