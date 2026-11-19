import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const safeCodes=new Set(["CG15_QUEUE_INVALID","CG15_QUEUE_NOT_FOUND","CG15_QUEUE_CHANGED",
 "CG15_QUEUE_REQUEST_CONFLICT","CG15_QUEUE_LIMIT"]);
function fail(status:number,message:string,code?:string){
 return NextResponse.json({message,...(code?{code}:{})},
  {status,headers:{"Cache-Control":"private, no-store"}});
}
function allowed(parts:string[],method:string){
 return parts.length===1&&parts[0]==="my-centers"&&method==="GET"||
  parts.length===2&&parts[0]==="my-centers"&&ID.test(parts[1])&&method==="GET"||
  parts.length===3&&parts[0]==="my-centers"&&ID.test(parts[1])&&
   parts[2]==="summary"&&method==="GET"||
  parts.length===3&&parts[0]==="my-centers"&&ID.test(parts[1])&&
   ["check-in","verify-slip","no-show"].includes(parts[2])&&method==="POST"||
  parts.length===5&&parts[0]==="my-centers"&&ID.test(parts[1])&&
   parts[2]==="visits"&&ID.test(parts[3])&&parts[4]==="transition"&&method==="POST";
}
async function run(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allowed(parts,method))return fail(404,"That visit-queue action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit visit actions from the CareGanga application.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in to manage your assigned healthcare center.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"The consultation queue is temporarily unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("body");
   body=JSON.stringify(raw);
   if(body.length>3500)throw Error("size");
  }catch{return fail(400,"Check the visit details and try again.");}
 }
 const params=new URLSearchParams();
 if(method==="GET"&&(parts.length===2||parts.length===3&&parts[2]==="summary")){
  const day=req.nextUrl.searchParams.get("date");
  if(!day||!/^\d{4}-\d\d-\d\d$/.test(day))
   return fail(400,"Select a valid consultation date.");
  params.set("date",day);
  const after=req.nextUrl.searchParams.get("after");
  if(after!==null){if(after.length>70)return fail(400,"Invalid queue page.");
   params.set("after",after);}
 }
 try{
  const path="/api/v1/appointments/queue/"+parts.join("/")+
   (params.size?"?"+params.toString():"");
  const response=await fetch(new URL(path,backend),{
   method,body,cache:"no-store",signal:AbortSignal.timeout(11000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}
  });
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const object=raw&&typeof raw==="object"&&!Array.isArray(raw)?
    raw as Record<string,unknown>:{};
   const code=typeof object.code==="string"&&safeCodes.has(object.code)?object.code:undefined;
   const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
   const msg=code&&typeof object.message==="string"&&object.message.length<=220?
    object.message:status===401?"Your session expired. Sign in again.":
    status===403?"Your role is not assigned to this healthcare center.":
    status===409?"The visit status changed. Refresh before retrying.":
    status===404?"This visit is not available to this center.":
    status===400?"Check the visit date and selected action.":
    "The visit result is uncertain. Refresh the current queue before retrying.";
   return fail(status,msg,code);
  }
  return NextResponse.json(raw,{status:response.status,
   headers:{"Cache-Control":"private, no-store"}});
 }catch{return fail(503,"Visit status is uncertain. Refresh this queue before retrying.");}
}
export async function GET(req:NextRequest,ctx:Context){
 return run(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Context){
 return run(req,(await ctx.params).parts,"POST");
}
