import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status:number,message:string)=>NextResponse.json({message},
 {status,headers:{"Cache-Control":"private, no-store"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(parts.length!==2||!ID.test(parts[0])||
  !(method==="GET"&&["status","file"].includes(parts[1])||
   method==="POST"&&parts[1]==="issue"))
  return fail(404,"This center consultation slip is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit the slip request from the CareGanga center portal.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in as an authorized current healthcare center visitor.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"The protected document service is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).length!==1||!("requestKey" in raw)||
    typeof raw.requestKey!=="string"||!ID.test(raw.requestKey))
    throw Error("source");
   body=JSON.stringify(raw);
  }catch{return fail(400,"Choose a valid original slip issue request.");}
 }
 try{
  const target=new URL("/api/v1/appointments/slips/staff/"+
   parts.map(encodeURIComponent).join("/"),backend);
  const response=await fetch(target,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})}});
  if(response.ok&&parts[1]==="file"){
   if(!response.headers.get("Content-Type")?.includes("application/pdf"))
    return fail(503,"Original consultation PDF type cannot be confirmed.");
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<100||bytes.byteLength>10485760)
    return fail(503,"Original consultation PDF size cannot be confirmed.");
   return new NextResponse(bytes,{headers:{
    "Content-Type":"application/pdf",
    "Content-Disposition":"attachment; filename=careganga-consultation.pdf",
    "Cache-Control":"private, no-store"}});
  }
  const data:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your center session expired. Sign in again.":
    status===403?"You cannot access a private appointment outside your current center.":
    status===404?"This current, consented consultation slip cannot be found.":
    status===409?"The original appointment or slip changed. Check its status.":
    status===429?"Too many slip attempts. Try again later.":
    status===400?"Check the original slip request details.":
    "The slip result is uncertain. Check the original status before retrying.");
  }
  return NextResponse.json(data,{headers:{"Cache-Control":"private, no-store"}});
 }catch{return fail(503,"The original slip result is uncertain. Check status before retrying.");}
}
export async function GET(req:NextRequest,c:Context){
 return forward(req,(await c.params).parts,"GET");
}
export async function POST(req:NextRequest,c:Context){
 return forward(req,(await c.params).parts,"POST");
}
