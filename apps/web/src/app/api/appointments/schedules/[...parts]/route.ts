import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const codes=new Set([
 "CG15_SCHEDULE_INVALID","CG15_SCHEDULE_CHANGED",
 "CG15_SCHEDULE_INELIGIBLE","CG15_SCHEDULE_OVERLAP",
 "CG15_SCHEDULE_OUTSIDE_CENTER_HOURS","CG15_SCHEDULE_DOCTOR_CONFLICT",
 "CG15_SCHEDULE_TIMEZONE_CONFLICT"
]);
const response=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"no-store"}
});
function allowed(p:string[],method:string){
 if(p[0]==="leave"){
  if(p.length===2&&p[1]==="ready")return method==="GET";
  if(p.length===3&&ID.test(p[1])&&p[2]==="apply")
   return method==="POST";
  return false;
 }
 if(p[0]==="admin"){
  if(p.length===1)return method==="GET";
  if(p.length===2&&ID.test(p[1]))return method==="GET"||method==="PUT";
  if(p.length===3&&ID.test(p[1])&&p[2]==="exceptions")
   return method==="POST";
  if(p.length===5&&ID.test(p[1])&&p[2]==="exceptions"&&
    ID.test(p[3])&&p[4]==="cancel")return method==="POST";
 }
 if(p[0]==="my-centers"&&p.length>=2&&ID.test(p[1])){
  if(p.length===2)return method==="GET";
  if(p.length===3&&ID.test(p[2]))return method==="GET"||method==="PUT";
  if(p.length===4&&ID.test(p[2])&&p[3]==="exceptions")
   return method==="POST";
  if(p.length===6&&ID.test(p[2])&&p[3]==="exceptions"&&
     ID.test(p[4])&&p[5]==="cancel")return method==="POST";
 }
 return false;
}
async function route(req:NextRequest,parts:string[],method:string){
 if(!allowed(parts,method))
  return response(404,"This scheduling action is unavailable.");
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return response(403,"Submit scheduling changes from CareGanga.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return response(401,"Sign in to manage the doctor's working hours.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return response(503,"Doctor scheduling is temporarily unavailable.");
 let body:string|undefined;
 if(method!=="GET"){
  try{
   const data:unknown=await req.json();
   if(!data||typeof data!=="object"||Array.isArray(data))
    throw Error("invalid payload");
   body=JSON.stringify(data);
   if(body.length>16000)throw Error("too long");
  }catch{return response(400,"Check the doctor scheduling form.");}
 }
 const url=new URL("/api/v1/appointments/schedules/"+parts.join("/"),backend);
 if(method==="GET"&&parts.length===1&&parts[0]==="admin"){
  const center=req.nextUrl.searchParams.get("centerRef");
  if(center){
   if(!ID.test(center))return response(400,"Choose a valid center.");
   url.searchParams.set("centerRef",center);
  }
 }
 try{
  const r=await fetch(url,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  if(!r.ok){
   const status=[400,401,403,404,409,429].includes(r.status)?r.status:503;
   const data:unknown=await r.json().catch(()=>null);
   if(status<500&&data&&typeof data==="object"&&"code" in data&&
    typeof data.code==="string"&&codes.has(data.code)&&
    "message" in data&&typeof data.message==="string"&&data.message.length<=220)
    return NextResponse.json({code:data.code,message:data.message},{
     status,headers:{"Cache-Control":"no-store"}});
   return response(status,status===401?"Your session expired. Sign in again.":
    status===403?"Your current role cannot change this doctor's schedule.":
    status===404?"The doctor or center is unavailable.":
    status===409?"This doctor schedule changed. Refresh before continuing.":
    status===429?"Too many attempts. Try again shortly.":
    status===400?"Check the working hours and dates.":
    "The result is uncertain. Refresh the original schedule before retrying.");
  }
  const data:unknown=await r.json();
  return NextResponse.json(data,{status:r.status,headers:{"Cache-Control":"no-store"}});
 }catch{
  return response(503,"The scheduling result is uncertain. Refresh before retrying.");
 }
}
export async function GET(req:NextRequest,ctx:Context){
 return route(req,(await ctx.params).parts,"GET");
}
export async function PUT(req:NextRequest,ctx:Context){
 return route(req,(await ctx.params).parts,"PUT");
}
export async function POST(req:NextRequest,ctx:Context){
 return route(req,(await ctx.params).parts,"POST");
}
