import {BadRequestException,ServiceUnavailableException} from "@nestjs/common";
import {createCipheriv,createHmac,randomBytes,timingSafeEqual} from "node:crypto";
import {date,fields,id,label} from "./payroll-input";
export function parsePayout(raw:unknown){
 const x=fields(raw,["requestKey","effectiveFrom","effectiveTo","supersedesRef","accountHolder","accountNumber","ifsc"]);
 const from=date(x.effectiveFrom),to=x.effectiveTo==null||x.effectiveTo===""?null:date(x.effectiveTo);
 if(to&&to<=from)throw new BadRequestException("End date must be after start date");
 const holder=label(x.accountHolder),account=x.accountNumber,ifsc=typeof x.ifsc==="string"?x.ifsc.trim().toUpperCase():"";
 if(typeof account!=="string"||!/^[0-9]{6,22}$/.test(account)||!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))throw new BadRequestException("Check the bank account number and IFSC");
 return {key:id(x.requestKey),supersedes:x.supersedesRef==null||x.supersedesRef===""?null:id(x.supersedesRef),from,to,holder,account,ifsc};
}
function encryptionKey(){
 const raw=process.env.CG11_PAYOUT_ENCRYPTION_KEY??"";
 if(!/^[A-Za-z0-9+/]{43}=$/.test(raw))throw new ServiceUnavailableException("Payroll destination protection is not configured");
 const k=Buffer.from(raw,"base64");
 if(k.length!==32)throw new ServiceUnavailableException("Payroll destination protection is not configured");
 return k;
}
/** Bind AES-GCM to the original root, employee and instruction; do not return plaintext. */
export function protectPayout(root:string,employee:string,instruction:string,v:ReturnType<typeof parsePayout>){
 const k=encryptionKey(),nonce=randomBytes(12);
 const plain=JSON.stringify({holder:v.holder,account:v.account,ifsc:v.ifsc});
 const cipher=createCipheriv("aes-256-gcm",k,nonce);
 cipher.setAAD(Buffer.from(JSON.stringify(["CG11_PAYOUT_V1",root,employee,instruction])));
 const encrypted=Buffer.concat([cipher.update(plain,"utf8"),cipher.final()]);
 const fingerprint=createHmac("sha256",k).update(JSON.stringify(["CG11_FINGERPRINT_V1",root,employee,plain])).digest("hex");
 const requestDigest=createHmac("sha256",k).update(JSON.stringify(["CG11_REQUEST_V1",root,employee,v])).digest("hex");
 return {ciphertext:encrypted.toString("base64url"),nonce:nonce.toString("base64url"),tag:cipher.getAuthTag().toString("base64url"),fingerprint,requestDigest,maskedDigits:v.account.slice(-4),maskedIfsc:v.ifsc.slice(0,4)+"*******"};
}

/** Compare independent transfer advice to the approved destination without decrypting stored details. */
export function matchesPayoutEvidence(root:string,employee:string,pinned:string,raw:unknown):boolean{
 const x=fields(raw,["accountHolder","accountNumber","ifsc"]),holder=label(x.accountHolder);
 const account=x.accountNumber,ifsc=typeof x.ifsc==="string"?x.ifsc.trim().toUpperCase():"";
 if(typeof account!=="string"||!/^[0-9]{6,22}$/.test(account)||!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)||! /^[a-f0-9]{64}$/.test(pinned))return false;
 const actual=createHmac("sha256",encryptionKey()).update(JSON.stringify(["CG11_FINGERPRINT_V1",root,employee,JSON.stringify({holder,account,ifsc})])).digest();
 return timingSafeEqual(actual,Buffer.from(pinned,"hex"));
}
