import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allowed(parts:string[],method:"GET"|"POST"){
 if(method==="GET"&&parts.length===2&&
    parts[0]==="centers"&&parts[1]==="eligible")return true;
 if(method==="GET"&&parts.length===3&&parts[0]==="centers"&&
    ID.test(parts[1])&&parts[2]==="completed-options")return true;
 if(parts.length>=4&&parts[0]==="centers"&&ID.test(parts[1])&&
   parts[2]==="appointments"&&ID.test(parts[3]))
  return parts.length===4&&method==="GET"||
    parts.length===5&&parts[4]==="recognize"&&method==="POST";
 return false;
}
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allowed(parts,method))return fail(404,"Foundation obligation action unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit from the authorized Foundation page.");
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return fail(401,"Sign in to your authorized Foundation account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Foundation obligation source is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value)||
    Object.keys(value).length!==1||!("requestKey" in value)||
    typeof value.requestKey!=="string"||!ID.test(value.requestKey))
    return fail(400,"Invalid original completed-service request.");
   body=JSON.stringify(value);
  }catch{return fail(400,"Invalid Foundation recognition request.");}
 }
 try{
  const url=new URL(
   "/api/v1/healthcare-assistance/foundation-liabilities/"+parts.join("/"),backend);
  const response=await fetch(url,{
   method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
   headers:{Authorization:"Bearer "+session,
    ...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const code=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(code,code===401?"Session expired. Sign in again.":
    code===403?"Your Foundation role does not permit this obligation.":
    code===404?"Original completed consultation or center is unavailable.":
    code===409?"Original service, benefit or liability changed. Refresh first.":
    code===400?"Review the original completed service and request.":
    "Foundation obligation outcome uncertain. Check the source before retrying.");
  }
  const value:unknown=await response.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value))
   return fail(503,"The original Foundation liability response is unavailable.");
  return NextResponse.json(value,{headers:{
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{
  return fail(503,"Original liability outcome is uncertain. Recheck its source.");
 }
}
export async function GET(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"POST");
}
