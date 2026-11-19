import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{bookingRef:string}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(status:number,message:string)=>NextResponse.json({message},
 {status,headers:{"Cache-Control":"private, no-store"}});
/** Original US-007-QA11: no public/assigned-center override proxy.
 * Only protected Foundation staff-cookie sessions may invoke root policy.
 */
export async function POST(req:NextRequest,ctx:Context){
 const {bookingRef}=await ctx.params;
 if(!ID.test(bookingRef))return reply(400,"Select a current appointment.");
 if(req.headers.get("origin")!==req.nextUrl.origin)
  return reply(403,"Confirm this exceptional action in CareGanga.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply(401,"Sign in as the protected Foundation administrator.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply(503,"Current booking changes are unavailable.");
 let payload:{requestKey:string;expectedVersion:number;reason:string;currentPassword:string};
 try{
  const raw:unknown=await req.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("input");
  const x=raw as Record<string,unknown>;
  if(Object.keys(x).some(k=>!["requestKey","expectedVersion","reason","currentPassword"].includes(k))||
   typeof x.requestKey!=="string"||!ID.test(x.requestKey)||
   !Number.isSafeInteger(x.expectedVersion)||Number(x.expectedVersion)<1||
   x.reason!=="FOUNDATION_OVERRIDE"||
   typeof x.currentPassword!=="string"||x.currentPassword.length<8||
   x.currentPassword.length>1024)throw Error("invalid");
  payload={requestKey:x.requestKey,expectedVersion:Number(x.expectedVersion),
   reason:"FOUNDATION_OVERRIDE",currentPassword:x.currentPassword};
 }catch{return reply(400,"Confirm the selected appointment, version and current password.");}
 try{
  const path="/api/v1/appointments/consultations/admin/bookings/"+
   encodeURIComponent(bookingRef)+"/cancel-override";
  const response=await fetch(new URL(path,backend),{
   method:"POST",cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify(payload)});
  const body:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return reply(status,
    status===409?"The original appointment was changed, started or is no longer eligible for override. Refresh its current status.":
    status===429?"Too many privileged confirmation attempts. Try again later.":
    status===403?"The Foundation root authorization or password confirmation was not accepted.":
    status===401?"Your Foundation session expired. Sign in again.":
    status===404?"The original appointment is not available.":
    status===400?"Review the exceptional cancellation inputs.":
    "Cancellation status is uncertain. Refresh the original booking before another attempt.");
  }
  return NextResponse.json(body,{
   status:response.status,headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return reply(503,"Cancellation outcome is uncertain. Refresh the original appointment before retrying.");
 }
}
