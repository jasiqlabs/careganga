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
  async submit(to: string, token: string): Promise<"PROVIDER_ACCEPTED" | "UNKNOWN" | "UNAVAILABLE"> {
    if (!this.isConfigured()) return "UNAVAILABLE";
    const transport=createTransport({
      host:process.env.AUTH_SMTP_HOST,
      port:465,
      secure:true,
      auth:{user:process.env.AUTH_SMTP_USER,pass:process.env.AUTH_SMTP_PASSWORD},
      connectionTimeout:5000,
      greetingTimeout:5000,
      socketTimeout:7000,
      pool:false,
      tls:{minVersion:"TLSv1.2",rejectUnauthorized:true}
    });
    try {
      await transport.sendMail({
        from:process.env.AUTH_EMAIL_FROM,
        to,
        subject:"CareGanga Foundation account recovery",
        text:"A recovery request was made for your CareGanga account.\n" +
          "Enter the recovery code in your original CareGanga app together with your authenticator code.\n\n"+
          "Recovery code: "+token+"\n\nExpires in 15 minutes.\n"+
          "If you did not request this, do not share this code.\n"
      });
      // This means only that the SMTP provider accepted the message, not inbox delivery.
      return "PROVIDER_ACCEPTED";
    } catch {
      // Timeout after provider acceptance cannot be distinguished from failure.
      return "UNKNOWN";
    } finally {
      transport.close();
    }
  }
}
