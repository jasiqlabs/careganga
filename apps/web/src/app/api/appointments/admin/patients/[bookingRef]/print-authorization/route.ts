import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context={params:Promise<{bookingRef:string}>};
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(req:NextRequest,{params}:Context){
 const {bookingRef}=await params;
 if(!ID.test(bookingRef)||req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Open the protected report from your current CareGanga admin page.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in to your authorized Foundation account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Protected report authorization is unavailable.");
 let body:unknown;
 try{body=await req.json();}catch{return fail(400,"Review the booking and try again.");}
 if(!body||typeof body!=="object"||Array.isArray(body))return fail(400,"Review the booking.");
 const v=body as Record<string,unknown>;
 if(Object.keys(v).some(k=>!["expectedVersion","purpose"].includes(k))||
  v.purpose!=="BOOKING_HISTORY"||!Number.isSafeInteger(v.expectedVersion)||
  Number(v.expectedVersion)<1||Number(v.expectedVersion)>2147483645)
  return fail(400,"Current booking version is required for printing.");
 try{
  const url=new URL("/api/v1/appointments/admin/patients/"+
   encodeURIComponent(bookingRef)+"/print-authorization",backend);
  const response=await fetch(url,{
   method:"POST",cache:"no-store",signal:AbortSignal.timeout(10000),
   headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body:JSON.stringify(v)});
  if(!response.ok){
   const status=[400,401,403,404,409].includes(response.status)?
    response.status:503;
   return fail(status,status===409?
    "This booking changed. Refresh its original history before printing.":
    status===403?"Your current role does not authorize this report.":
    status===401?"Your session expired. Sign in again.":
    "The original booking report could not be authorized.");
  }
  const data:unknown=await response.json();
  if(!data||typeof data!=="object"||!("authorized" in data)||
   data.authorized!==true)
   return fail(503,"The original booking report authorization could not be confirmed.");
  return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
 }catch{return fail(503,"Report status is uncertain. Refresh the original booking.");}
}
