import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const safeCodes=new Set([
 "CG15_PATIENT_INVALID","CG15_PATIENT_CONSENT_REQUIRED",
 "CG15_PATIENT_REQUEST_CONFLICT","CG15_PATIENT_CENTER_UNAVAILABLE",
 "CG15_PATIENT_INTAKE_NOT_FOUND"
]);
function reply(status:number,message:string,code?:string){
 return NextResponse.json({message,...(code?{code}:{})},
  {status,headers:{"Cache-Control":"no-store"}});
}
function allowed(parts:string[],method:string){
 return parts.length===2&&parts[0]==="my-centers"&&
   parts[1]==="intake-options"&&method==="GET"||
   parts.length===3&&parts[0]==="my-centers"&&ID.test(parts[1])&&
   ["intakes","verify-identity"].includes(parts[2])&&method==="POST"||
   parts.length===4&&parts[0]==="my-centers"&&ID.test(parts[1])&&
   parts[2]==="intakes"&&ID.test(parts[3])&&method==="GET";
}
async function serve(request:NextRequest,parts:string[],method:"POST"|"GET"){
 if(!allowed(parts,method))return reply(404,"Patient intake is unavailable.");
 if(method==="POST"&&request.headers.get("origin")!==request.nextUrl.origin)
  return reply(403,"Submit patient intake only from CareGanga.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply(401,"Sign in as authorized center staff.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply(503,"Center patient intake is temporarily unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const data:unknown=await request.json();
   if(!data||typeof data!=="object"||Array.isArray(data))throw Error();
   body=JSON.stringify(data);
   if(body.length>5000)throw Error();
  }catch{return reply(400,"Check the patient details and try again.");}
 }
 try{
  const r=await fetch(new URL("/api/v1/appointments/patients/"+parts.join("/"),backend),{
   method,body,cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})}
  });
  if(!r.ok){
   const status=[400,401,403,404,409,429].includes(r.status)?r.status:503;
   const v:unknown=await r.json().catch(()=>null);
   const item=v&&typeof v==="object"&&!Array.isArray(v)?v as Record<string,unknown>:{};
   const code=typeof item.code==="string"&&safeCodes.has(item.code)?item.code:undefined;
   const message=code&&typeof item.message==="string"&&item.message.length<=220?
    item.message:status===401?"Your session has expired. Sign in again.":
    status===403?"Your current role or center assignment cannot register patients.":
    status===404?"The center or submitted intake request is not available.":
    status===409?"This request was already changed. Check its saved result.":
    status===429?"Too many attempts. Please try again later.":
    status===400?"Review the patient details and consent attestation.":
    "We could not confirm the result. Check the original request before retrying.";
   return reply(status,message,code);
  }
  return NextResponse.json(await r.json() as unknown,{
   status:r.status,headers:{"Cache-Control":"no-store"}});
 }catch{
  return reply(503,"The intake result could not be confirmed. Check the original request.");
 }
}
export async function GET(req:NextRequest,ctx:Context){
 return serve(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Context){
 return serve(req,(await ctx.params).parts,"POST");
}
