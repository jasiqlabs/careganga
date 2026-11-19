import {createCipheriv,createHmac,randomBytes} from "node:crypto";
import {BadRequestException,ServiceUnavailableException} from "@nestjs/common";

/** Original CG15 optional patient-entered consultation reason, not a health
 * record or notification. Encrypt authenticated with root and appointment
 * as AAD; never log, render to QR, or write plaintext event snapshots.
 */
export function prepareConsultationReason(raw:unknown,assisted:boolean){
 if(raw===undefined||raw===null||raw==="")return null;
 if(assisted||typeof raw!=="string")
  throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
 const value=raw.trim().replace(/\s+/g," ");
 if(!value||value.length>300||Buffer.byteLength(value,"utf8")>1200||
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value))
  throw new BadRequestException({code:"CG15_BOOKING_INVALID"});
 const configured=process.env.CG15_BOOKING_REASON_KEY_BASE64?.trim()??"";
 // Exact canonical 32-byte base64 secret. Never create a runtime key or
 // silently store a patient's private text without authenticated encryption.
 if(!/^[A-Za-z0-9+/]{43}=$/.test(configured))
  throw new ServiceUnavailableException({
   code:"CG15_BOOKING_PRIVATE_REASON_UNAVAILABLE"});
 const key=Buffer.from(configured,"base64");
 if(key.length!==32||key.toString("base64")!==configured)
  throw new ServiceUnavailableException({
   code:"CG15_BOOKING_PRIVATE_REASON_UNAVAILABLE"});
 const signatureDigest=createHmac("sha256",key).update(value,"utf8").digest("hex");
 return {signatureDigest,encrypt(realm:string,booking:string){
  const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key,iv);
  cipher.setAAD(Buffer.from(realm+":"+booking+":PATIENT_CARE","utf8"));
  const ciphertext=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);
  return {ciphertext,iv,tag:cipher.getAuthTag()};
 }};
}
