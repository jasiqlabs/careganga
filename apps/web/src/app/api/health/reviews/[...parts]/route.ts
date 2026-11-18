import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function safe(status:number,message:string){return NextResponse.json({message},{
 status,headers:{"Cache-Control":"no-store"}
});}
async function proxy(req:NextRequest,parts:string[],method:"GET"|"POST"){
 const valid=method==="GET"&&(
   parts.length===0||parts.length===1&&UUID.test(parts[0]))||
   method==="POST"&&parts.length===2&&UUID.test(parts[0])&&parts[1]==="decide";
 if(!valid)return safe(404,"Healthcare review action unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return safe(403,"Submit this review from CareGanga.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return safe(401,"Sign in to review healthcare registrations.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return safe(503,"Healthcare review is temporarily unavailable.");
 const url=new URL("/api/health/reviews"+
   (parts.length?"/"+parts.join("/"):""),backend);
 if(method==="GET"&&parts.length===0)url.search=req.nextUrl.search;
 let body:string|undefined;
 if(method==="POST"){
  try{
   const data:unknown=await req.json();
   if(!data||typeof data!=="object"||Array.isArray(data))throw Error();
   body=JSON.stringify(data);
   if(body.length>3500)throw Error();
  }catch{return safe(400,"Review details are invalid.");}
 }
 try{
  const response=await fetch(url,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
     response.status:503;
   const raw:unknown=await response.json().catch(()=>null);
   if(status<500&&raw&&typeof raw==="object"&&"code" in raw&&
      ["HEALTH_REVIEW_INVALID","HEALTH_REVIEW_UNAVAILABLE","HEALTH_REVIEW_CONFLICT",
       "HEALTH_REVIEW_SOURCE_CHANGED","HEALTH_REVIEW_PROOF_NOT_CURRENT"].includes(
          String(raw.code))&&"message" in raw&&typeof raw.message==="string"&&
      raw.message.length<=240)
    return NextResponse.json({code:raw.code,message:raw.message},{
      status,headers:{"Cache-Control":"no-store"}});
   return safe(status,status===401?"Your session expired. Sign in again.":
     status===403?"You are not authorized to review this registration.":
     status===404?"The requested review is unavailable.":
     status===409?"This review changed. Refresh the current case.":
     status===429?"Too many requests. Try again later.":
     status===400?"Review details are invalid.":
     "Review result is uncertain. Check the original case before retrying.");
  }
  return NextResponse.json(await response.json(),{
    status:response.status,headers:{"Cache-Control":"no-store"}});
 }catch{return safe(503,"The review result is uncertain. Check the original case before retrying.");}
}
export async function GET(req:NextRequest,ctx:Ctx){
 return proxy(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Ctx){
 return proxy(req,(await ctx.params).parts,"POST");
}
