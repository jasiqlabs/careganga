import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const CODE=/^CG-[A-F0-9]{14}$/;
const codes=new Set(["CG17_PARTNER_REVIEW_INVALID","CG17_PARTNER_REVIEW_UNAVAILABLE",
 "CG17_PARTNER_REVIEW_SOURCE_CHANGED","CG17_PARTNER_REVIEW_ALREADY_DECIDED",
 "CG17_PARTNER_REVIEW_PROOF_UNAVAILABLE"]);
const reject=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
function valid(parts:string[],method:"GET"|"POST"){
 if(![5,6,7].includes(parts.length))return false;
 if(!["partner","foundation"].includes(parts[0])||parts[1]!=="centers"||
   !UUID.test(parts[2])||parts[3]!=="claims"||!CODE.test(parts[4]))
  return false;
 if(method==="GET")return parts.length===5||
  (parts.length===7&&parts[0]==="foundation"&&
   parts[5]==="evidence"&&["invoice","completion","payment"].includes(parts[6]));
 return parts.length===6&&(parts[0]==="partner"&&parts[5]==="attest"||
  parts[0]==="foundation"&&parts[5]==="decide");
}
async function relay(req:NextRequest,method:"GET"|"POST",ctx:Context){
 const {parts}=await ctx.params;
 if(!valid(parts,method)||[...req.nextUrl.searchParams.keys()].length)
  return reject(404,"That partner review action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reject(403,"Use your signed-in CareGanga review page.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reject(401,"Sign in to your authorized Foundation or partner account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return reject(503,"Partner verification source is temporarily unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const data:unknown=await req.json();
   if(!data||typeof data!=="object"||Array.isArray(data))throw Error("invalid");
   const keys=Object.keys(data);
   const required=parts[0]==="partner"?
    ["requestKey","collectedMinor","paymentMethod","invoiceChecked","servicePerformed"]:
    ["requestKey","action","reason","currentPassword"];
   if(keys.length!==required.length||keys.some(k=>!required.includes(k)))
    throw Error("invalid");
   body=JSON.stringify(data);
   if(body.length>2500)throw Error("large");
  }catch{return reject(400,"Check the verified service and review form.");}
 }
 try{
  const path="/api/v1/healthcare-assistance/partner-verification/"+
   parts.map(encodeURIComponent).join("/");
  const response=await fetch(new URL(path,backend),{method,body,
   cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   const raw:unknown=await response.json().catch(()=>null);
   const v=raw&&typeof raw==="object"&&!Array.isArray(raw)?
    raw as Record<string,unknown>:null;
   const safe=v&&typeof v.code==="string"&&codes.has(v.code)&&
    typeof v.message==="string"&&v.message.length<=220&&
    !/[<>\r\n]/.test(v.message)?v.message:null;
   return reject(status,safe??(status===401?"Your session expired. Sign in again.":
    status===403?"Your account cannot perform this protected review.":
    status===404?"This original claim or verified center is unavailable.":
    status===409?"The original proof or decision changed. Refresh before retrying.":
    status===429?"Too many verification attempts. Please try again later.":
    status===400?"Check the original collected amount and evidence.":
    "Original verification outcome is uncertain. Check the claim status."));
  }
  if(parts.length===7&&parts[5]==="evidence"){
   const mime=response.headers.get("Content-Type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))
    return reject(503,"Verified document format is unavailable.");
   const source=await response.arrayBuffer();
   if(source.byteLength<1||source.byteLength>10485760)
    return reject(503,"Verified document size could not be confirmed.");
   return new NextResponse(source,{status:200,headers:{
    "Cache-Control":"private, no-store","Content-Type":mime,
    "X-Content-Type-Options":"nosniff",
    "Content-Disposition":'attachment; filename="CareGanga-private-partner-evidence"'
   }});
  }
  const responseBody:unknown=await response.json();
  if(!responseBody||typeof responseBody!=="object"||Array.isArray(responseBody))
   return reject(503,"Original partner verification could not be confirmed.");
  return NextResponse.json(responseBody,{
   headers:{"Cache-Control":"private, no-store"}});
 }catch{return reject(503,
  "Original review outcome could not be confirmed. Check the existing claim before retrying.");}
}
export const GET=(req:NextRequest,ctx:Context)=>relay(req,"GET",ctx);
export const POST=(req:NextRequest,ctx:Context)=>relay(req,"POST",ctx);
