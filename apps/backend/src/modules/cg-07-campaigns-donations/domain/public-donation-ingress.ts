import {ForbiddenException,ServiceUnavailableException} from "@nestjs/common";
import {createHmac,timingSafeEqual} from "node:crypto";
/** Do not trust X-Forwarded-Host, X-Forwarded-For or unsiged IP headers.
 * Host is an ingress routing guard, NOT donor authentication; donor proof is
 * independently required to read private transactions.
 */
type Peer={headers?:Record<string,string|string[]|undefined>;
 socket?:{remoteAddress?:string}};
const one=(x:string|string[]|undefined)=>typeof x==="string"?x:"";
function allowedHosts():string[]{
 const env=process.env.CG07_PUBLIC_API_HOSTS?.trim()??"";
 const fallback=process.env.WEB_ORIGIN??"";
 const candidates=env?env.split(","):[(()=>{try{return new URL(fallback).host;}catch{return "";}})()];
 return candidates.map(x=>x.trim().toLowerCase()).filter(x=>
  /^(?:\[[a-f0-9:]+\]|[a-z0-9.-]+)(?::[0-9]{1,5})?$/.test(x));
}
export function assertDonationPublicIngress(req:object,kind:"donor"|"webhook"){
 const headers=(req as Peer).headers??{};
 const host=one(headers.host).trim().toLowerCase();
 const list=allowedHosts();
 if(!host||!list.length||!list.includes(host))
  throw new ForbiddenException("Current Foundation public donation host is not verified.");
 if(kind==="donor"){
  const origin=one(headers.origin);
  if(origin&&origin!==(process.env.WEB_ORIGIN??""))
   throw new ForbiddenException("Use the current CareGanga donation form.");
  if(one(headers["sec-fetch-site"])==="cross-site")
   throw new ForbiddenException("Cross-site donor requests are unavailable.");
 }
}
export function verifiedDonationPeer(req:object,scope:"create"|"status"):string{
 const source=req as Peer,remote=source.socket?.remoteAddress;
 if(!remote||remote.length>80||!/^[0-9a-fA-F:.]{2,80}$/.test(remote))
  throw new ServiceUnavailableException("Public donation peer unavailable.");
 const headers=source.headers??{};
 const client=one(headers["x-cg07-proxy-client"]),
  timestamp=one(headers["x-cg07-proxy-ts"]),
  signature=one(headers["x-cg07-proxy-proof"]);
 if(!client&&!timestamp&&!signature)return remote;
 const key=Buffer.from(process.env.CG07_PUBLIC_PROXY_KEY??"","base64");
 if(key.length!==32||!/^[0-9a-fA-F:.]{2,45}$/.test(client)||
  !/^\d{13}$/.test(timestamp)||Math.abs(Date.now()-Number(timestamp))>60000||
  !/^[a-f0-9]{64}$/i.test(signature))
  throw new ForbiddenException("Trusted donation ingress proof is invalid.");
 const expected=createHmac("sha256",key)
  .update("cg07:"+scope+":"+timestamp+":"+client).digest();
 if(!timingSafeEqual(expected,Buffer.from(signature,"hex")))
  throw new ForbiddenException("Trusted donation ingress proof is invalid.");
 return client;
}
