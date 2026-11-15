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
