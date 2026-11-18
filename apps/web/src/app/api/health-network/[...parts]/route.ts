import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx={params:Promise<{parts:string[]}>};
const reply=(status:number,message:string)=>NextResponse.json({message},{
  status,headers:{"Cache-Control":"no-store"}
});
const errors=new Set([
  "HEALTH_FIELD_INVALID","HEALTH_VERSION_INVALID","HEALTH_GEOGRAPHY_INVALID",
  "HEALTH_HOURS_OVERLAP","HEALTH_DUPLICATE","HEALTH_REQUEST_CONFLICT",
  "HEALTH_VERSION_CHANGED","HEALTH_REPRESENTATIVE_NOT_ELIGIBLE",
  "HEALTH_REPRESENTATIVE_EXISTS","HEALTH_REPRESENTATIVE_REVOKED","HEALTH_EVIDENCE_INVALID",
  "HEALTH_EVIDENCE_REPLAY_CONFLICT","HEALTH_EVIDENCE_SOURCE_CHANGED",
  "HEALTH_EVIDENCE_NOT_VERIFIED","HEALTH_FINANCE_MASK_INVALID",
  "HEALTH_DOCTOR_FIELD_INVALID","HEALTH_DOCTOR_VERSION_INVALID",
  "HEALTH_DOCTOR_DUPLICATE","HEALTH_DOCTOR_REQUEST_CONFLICT",
  "HEALTH_DOCTOR_NOT_PENDING","HEALTH_DOCTOR_VERSION_CHANGED",
  "HEALTH_DOCTOR_UNAVAILABLE","HEALTH_DOCTOR_NOT_VERIFIED",
  "HEALTH_DOCTOR_REVIEW_INVALID","HEALTH_DOCTOR_REVIEW_SOURCE_CHANGED",
  "HEALTH_DOCTOR_REVIEW_UNAVAILABLE","HEALTH_DOCTOR_ASSOCIATION_UNAVAILABLE",
  "HEALTH_DOCTOR_ASSOCIATION_CHANGED","HEALTH_CENTER_STAFF_UNAVAILABLE",
  "HEALTH_DOCTOR_FEE_INVALID","HEALTH_DOCTOR_FEE_INELIGIBLE",
  "HEALTH_DOCTOR_FEE_OVERLAP","HEALTH_DOCTOR_FEE_REQUEST_CONFLICT",
  "HEALTH_DOCTOR_FEE_STALE","HEALTH_DOCTOR_FEE_UNAVAILABLE",
  "HEALTH_DOCTOR_FEE_CHANGED","HEALTH_CONTENT_INVALID","HEALTH_CONTENT_REQUEST_CONFLICT",
  "HEALTH_CONTENT_VERSION_CHANGED","HEALTH_CONTENT_SOURCE_CHANGED",
  "HEALTH_CONTENT_REVIEW_CONFLICT","HEALTH_CONTENT_REQUIRED","HEALTH_CONTENT_ALREADY_WITHDRAWN",
  "HEALTH_ERP_GRANT_INVALID","HEALTH_ERP_GRANT_CHANGED","HEALTH_ERP_GRANT_SOURCE_CHANGED"
]);
function allowed(parts:string[],method:string){
  if(parts.length===3&&parts[0]==="my-centers"&&parts[1]==="content"&&
    parts[2]==="publishing")return method==="GET";
  if(parts[0]==="erp-grants"){
    if(parts.length===2&&parts[1]==="foundation")return method==="GET";
    if(parts.length===3&&parts[1]==="my-centers"&&UUID.test(parts[2]))
      return method==="GET"||method==="POST";
    if(parts.length===4&&parts[1]==="reviews"&&UUID.test(parts[2])&&
       parts[3]==="apply")return method==="POST";
    if(parts.length===5&&parts[1]==="foundation"&&UUID.test(parts[2])&&
       ["LAB_ERP","PHARMACY_ERP","NURSING_ERP","OT_ERP"].includes(parts[3])&&
       ["suspend","withdraw"].includes(parts[4]))return method==="POST";
    return false;
  }
  // Doctor drafts are private and permission-checked again in CG01/Nest.
  // No public routes, approval, fee, booking or consent claims are exposed.
  if(parts[0]==="doctors"){
    if(parts.length===1)return method==="GET"||method==="POST";
    if(parts.length===2&&parts[1]==="eligible-centers")return method==="GET";
    if(parts.length===2&&UUID.test(parts[1]))
      return method==="GET"||method==="PATCH";
    if(parts.length===3&&UUID.test(parts[1])&&parts[2]==="centers")
      return method==="GET"||method==="POST";
    if(parts.length===5&&UUID.test(parts[1])&&parts[2]==="centers"&&
      UUID.test(parts[3])&&parts[4]==="fees")
      return method==="GET"||method==="POST";
    if(parts.length===7&&UUID.test(parts[1])&&parts[2]==="centers"&&
      UUID.test(parts[3])&&parts[4]==="fees"&&UUID.test(parts[5])&&
      parts[6]==="approve")return method==="POST";
    if(parts.length===5&&UUID.test(parts[1])&&parts[2]==="centers"&&
      UUID.test(parts[3])&&["approve","suspend"].includes(parts[4]))
      return method==="POST";
    if(parts.length===3&&UUID.test(parts[1])&&parts[2]==="suspend")
      return method==="POST";
    if(parts.length===3&&UUID.test(parts[1])&&parts[2]==="submit")
      return method==="POST";
    if(parts.length===4&&parts[1]==="reviews"&&UUID.test(parts[2])&&
      ["apply","return-to-draft"].includes(parts[3]))return method==="POST";
    return false;
  }
  if(parts[0]==="my-centers"&&parts.length===3&&UUID.test(parts[1])&&
    parts[2]==="content")return method==="GET"||method==="PATCH";
  if(parts[0]==="my-centers"&&parts.length===4&&UUID.test(parts[1])&&
    parts[2]==="content"&&["submit","withdraw"].includes(parts[3]))
    return method==="POST";
  if(parts[0]==="my-centers"&&parts.length===5&&
    parts[1]==="content"&&parts[2]==="reviews"&&UUID.test(parts[3])&&
    parts[4]==="apply")return method==="POST";
  if(parts[0]==="my-centers"&&parts.length===6&&UUID.test(parts[1])&&
    parts[2]==="content"&&parts[3]==="reviews"&&UUID.test(parts[4])&&
    parts[5]==="reopen")return method==="POST";
  if(parts[0]==="my-centers"&&parts.length===3&&UUID.test(parts[1])&&
    parts[2]==="eligible-doctors")return method==="GET";
  if(parts[0]==="my-centers"&&parts.length===3&&UUID.test(parts[1])&&
    parts[2]==="doctors")return method==="GET"||method==="POST";
  if(parts[0]==="my-centers"&&parts.length===7&&UUID.test(parts[1])&&
    parts[2]==="doctors"&&UUID.test(parts[3])&&parts[4]==="associations"&&
    UUID.test(parts[5])&&parts[6]==="fees")
    return method==="GET"||method==="POST";
  if(parts.length===1){
    if(parts[0]==="providers")return method==="GET"||method==="POST";
    if(parts[0]==="geography"||parts[0]==="my-centers")return method==="GET";
  }
  if(parts.length===2&&parts[0]==="representatives"&&parts[1]==="options"){
    return method==="GET";
  }
  if(parts.length===2&&UUID.test(parts[1])){
    if(parts[0]==="providers")return method==="GET"||method==="PATCH";
    if(parts[0]==="my-centers")return method==="GET"||method==="PATCH";
    if(parts[0]==="centers")return method==="GET"||method==="PATCH";
  }
  if(parts.length===3&&UUID.test(parts[1])){
    if(parts[0]==="providers"&&parts[2]==="centers")return method==="POST";
    if(parts[0]==="providers"&&parts[2]==="finance-reference")return method==="GET"||method==="POST";
    if(parts[0]==="centers"&&parts[2]==="representatives")return method==="GET"||method==="POST";
  }
  if(parts.length===3&&UUID.test(parts[1])){
    if(parts[0]==="providers"&&["submit","suspend","reopen"].includes(parts[2]))return method==="POST";
    if(parts[0]==="centers"&&["submit","access","publication","suspend","reopen"].includes(parts[2]))
      return method==="POST";
    if(parts[0]==="my-centers"&&parts[2]==="submit")return method==="POST";
  }
  if(parts.length===4&&["providers","centers"].includes(parts[0])&&
    parts[1]==="reviews"&&UUID.test(parts[2])&&
    ["apply","return-to-draft"].includes(parts[3]))
    return method==="POST";
  if(parts.length===5&&parts[0]==="centers"&&UUID.test(parts[1])&&
    parts[2]==="representatives"&&UUID.test(parts[3])&&parts[4]==="revoke")
    return method==="POST";
  return false;
}
async function proxy(request:NextRequest,parts:string[],method:string){
  if(!allowed(parts,method))return reply(404,"This healthcare action is unavailable.");
  if(method!=="GET"&&request.headers.get("origin")!==request.nextUrl.origin)
    return reply(403,"Submit this healthcare change from CareGanga.");
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return reply(401,"Sign in to access healthcare registration.");
  const backend=process.env.BACKEND_URL;
  if(!backend)return reply(503,"Healthcare registration is temporarily unavailable.");
  let body:string|undefined;
  if(method!=="GET"){
    try{
      const parsed:unknown=await request.json();
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Invalid form");
      body=JSON.stringify(parsed);
      if(body.length>20000)throw Error("Form too large");
    }catch{return reply(400,"Check the healthcare form before submitting.");}
  }
  const target=new URL("/api/v1/health-network/"+parts.join("/"),backend);
  if(method==="GET")target.search=request.nextUrl.search;
  try{
    const response=await fetch(target,{
      method,body,cache:"no-store",signal:AbortSignal.timeout(12000),
      headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}
    });
    if(!response.ok){
      const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
      const raw:unknown=await response.json().catch(()=>null);
      if(status<500&&raw&&typeof raw==="object"&&"code" in raw&&
         typeof raw.code==="string"&&errors.has(raw.code)&&"message" in raw&&
         typeof raw.message==="string"&&raw.message.length<=240){
        const field="field" in raw&&typeof raw.field==="string"&&
          /^[A-Za-z][A-Za-z0-9]{0,35}$/.test(raw.field)?raw.field:null;
        return NextResponse.json({code:raw.code,message:raw.message,...(field?{field}:{})},{
          status,headers:{"Cache-Control":"no-store"}});
      }
      const message=status===401?"Your session expired. Sign in again.":
        status===403?"You do not have access to this healthcare record.":
        status===404?"This pending healthcare record is unavailable.":
        status===409?"The healthcare draft changed. Refresh before saving.":
        status===429?"Too many requests. Try again later.":
        status===400?"Check the healthcare registration details.":
        "The result is uncertain. Check the original saved request before retrying.";
      return reply(status,message);
    }
    const payload:unknown=await response.json();
    return NextResponse.json(payload,{status:response.status,headers:{"Cache-Control":"no-store"}});
  }catch{
    return reply(503,"The result is uncertain. Refresh and check the original draft before retrying.");
  }
}
export async function GET(req:NextRequest,ctx:Ctx){return proxy(req,(await ctx.params).parts,"GET");}
export async function POST(req:NextRequest,ctx:Ctx){return proxy(req,(await ctx.params).parts,"POST");}
export async function PATCH(req:NextRequest,ctx:Ctx){return proxy(req,(await ctx.params).parts,"PATCH");}
