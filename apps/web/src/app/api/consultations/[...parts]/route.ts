import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const allowed=(p:string[],method:string)=>
 method==="POST"&&p.length===1&&["holds","confirm"].includes(p[0])||
 method==="GET"&&p.length===1&&p[0]==="me"||
 method==="GET"&&p.length===2&&p[0]==="me"&&ID.test(p[1])||
 method==="GET"&&p.length===5&&p[0]==="me"&&ID.test(p[1])&&
 p[2]==="reschedule"&&p[3]==="by-request"&&ID.test(p[4])||
 method==="GET"&&p.length===3&&p[0]==="me"&&ID.test(p[1])&&p[2]==="calendar.ics"||
 method==="GET"&&p.length===3&&p[0]==="holds"&&
  p[1]==="by-request"&&ID.test(p[2])||
 method==="GET"&&p.length===3&&p[0]==="confirmations"&&
  p[1]==="by-request"&&ID.test(p[2])||
 method==="GET"&&p.length===2&&p[0]==="holds"&&ID.test(p[1])||
 method==="POST"&&p.length===3&&p[0]==="me"&&ID.test(p[1])&&
 ["cancel","reschedule"].includes(p[2]);
const copy=(status:number,message:string,code?:string)=>NextResponse.json(
 {message,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
const safeCodes=new Set([
 "CG15_BOOKING_PRIVATE_REASON_UNAVAILABLE", "CG15_BOOKING_INVALID","CG15_BOOKING_HOLD_NOT_CONFIGURED",
 "CG15_BOOKING_PATIENT_NOT_READY","CG15_BOOKING_SLOT_CHANGED",
 "CG15_BOOKING_PRICE_CHANGED","CG15_BOOKING_SLOT_TAKEN",
 "CG15_BOOKING_REQUEST_CONFLICT","CG15_BOOKING_NOT_FOUND",
 "CG15_BOOKING_HOLD_EXPIRED","CG15_BOOKING_CHANGE_CLOSED",
 "CG15_BOOKING_CHANGE_POLICY_UNAVAILABLE"
]);
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allowed(parts,method))return copy(404,"This booking action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return copy(403,"Submit your booking from the CareGanga website.");
 const token=(await cookies()).get("cg_patient_session")?.value;
 if(!token)return copy(401,"Sign in to your CareGanga patient profile before booking.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return copy(503,"Appointments are temporarily unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("payload");
   body=JSON.stringify(raw);
   if(body.length>4000)throw Error("length");
  }catch{return copy(400,"Check the selected booking details and try again.");}
 }
 try{
  const path="/api/v1/appointments/consultations/"+parts.join("/");
  const params=new URLSearchParams();
  if(method==="GET"&&parts.length===1&&parts[0]==="me"){
   params.set("limit","20");
   const after=req.nextUrl.searchParams.get("after");
   if(after!==null){
    if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}Z\|[a-f0-9-]{36}$/i.test(after)||
     after.length>80)return copy(400,"Choose a valid appointment history page.");
    params.set("after",after);
   }
  }
  const response=await fetch(new URL(path+
   (params.size?"?"+params.toString():""),backend),{
   method,body,cache:"no-store",signal:AbortSignal.timeout(13000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}
  });
  if(method==="GET"&&parts.length===3&&parts[2]==="calendar.ics"&&response.ok){
   const data=await response.text();
   if(data.length>10000)return copy(503,"Calendar file is temporarily unavailable.");
   return new NextResponse(data,{status:200,headers:{
    "Content-Type":"text/calendar; charset=utf-8",
    "Content-Disposition":"attachment; filename=careganga-consultation.ics",
    "Cache-Control":"private, no-store"}});
  }
  const raw:unknown=await response.json().catch(()=>null);
  const data=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
   const code=typeof data.code==="string"&&safeCodes.has(data.code)?data.code:undefined;
   const message=typeof data.message==="string"&&code&&data.message.length<=220?
    data.message:status===401?"Your session expired. Sign in again.":
    status===403?"Your patient profile is not eligible for this action.":
    status===409?"This time or price changed. Refresh the schedule before retrying.":
    status===404?"This reservation is no longer available.":
    status===429?"Too many requests. Try again later.":
    status===400?"Check the appointment details and retry.":
    "The booking outcome is uncertain. Check the original request before retrying.";
   return copy(status,message,code);
  }
  return NextResponse.json(raw,{status:response.status,
   headers:{"Cache-Control":"private, no-store"}});
 }catch{return copy(503,"The request result is uncertain. Check your appointments before retrying.");}
}
export async function GET(req:NextRequest,c:Context){
 return forward(req,(await c.params).parts,"GET");
}
export async function POST(req:NextRequest,c:Context){
 return forward(req,(await c.params).parts,"POST");
}
