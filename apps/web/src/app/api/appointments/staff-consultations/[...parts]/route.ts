import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const acceptable=(p:string[],method:string)=>
 method==="POST"&&p.length===1&&["holds","confirm"].includes(p[0])||
 method==="GET"&&p.length===3&&p[0]==="centers"&&ID.test(p[1])&&p[2]==="doctors"||
 method==="GET"&&p.length===5&&p[0]==="centers"&&ID.test(p[1])&&
 p[2]==="doctor"&&ID.test(p[3])&&p[4]==="slots"||
 method==="GET"&&p.length===3&&["holds","confirmations"].includes(p[0])&&
 p[1]==="by-request"&&ID.test(p[2]);
const fail=(status:number,message:string)=>NextResponse.json({message},
 {status,headers:{"Cache-Control":"private, no-store"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!acceptable(parts,method))
  return fail(404,"This center consultation action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit the center booking through CareGanga.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in as authorized healthcare reception staff.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Center booking is temporarily unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("input");
   body=JSON.stringify(raw);
   if(body.length>4000)throw Error("size");
  }catch{return fail(400,"Check the original patient and appointment details.");}
 }
 const query=new URLSearchParams();
 if(method==="GET"&&parts.length===5){
  const day=req.nextUrl.searchParams.get("date");
  if(!day||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(day))
   return fail(400,"Choose a valid consultation date.");
  query.set("date",day);
 }
 try{
  const path="/api/v1/appointments/consultations/staff/"+parts.join("/")+
   (query.size?"?"+query.toString():"");
  const res=await fetch(new URL(path,backend),{
   method,body,cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})}});
  const data:unknown=await res.json().catch(()=>null);
  if(!res.ok){
   const code=data&&typeof data==="object"&&"code" in data?
    (data as {code?:unknown}).code:null;
   const message=data&&typeof data==="object"&&"message" in data?
    (data as {message?:unknown}).message:null;
   const allowed=new Set(["CG15_BOOKING_INVALID","CG15_BOOKING_SLOT_CHANGED",
    "CG15_BOOKING_SLOT_TAKEN","CG15_BOOKING_HOLD_EXPIRED",
    "CG15_BOOKING_PATIENT_NOT_READY","CG15_BOOKING_PRICE_CHANGED",
    "CG15_BOOKING_REQUEST_CONFLICT","CG15_BOOKING_NOT_FOUND"]);
   return fail([400,401,403,404,409,429].includes(res.status)?res.status:503,
    typeof code==="string"&&allowed.has(code)&&typeof message==="string"&&
    message.length<=220?message:
    res.status===403?"Your account is not assigned to this healthcare center.":
    res.status===409?"The slot, price or patient authorization changed. Refresh the original request.":
    "The booking outcome is uncertain. Check the original request.");
  }
  return NextResponse.json(data,{status:res.status,headers:{"Cache-Control":"private, no-store"}});
 }catch{return fail(503,"Booking result is uncertain. Verify the original request before retrying.");}
}
export async function GET(req:NextRequest,ctx:Context){
 return forward(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Context){
 return forward(req,(await ctx.params).parts,"POST");
}
