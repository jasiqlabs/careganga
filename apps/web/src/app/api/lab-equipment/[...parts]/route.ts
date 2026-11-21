import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status:number,message:string)=>NextResponse.json({message},{status,
 headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
function allowed(parts:string[],method:string){
 if(parts.length===2&&parts[0]==="centers"&&parts[1]==="eligible")
  return method==="GET";
 if(parts.length===3&&parts[0]==="centers"&&UUID.test(parts[1])&&
   parts[2]==="items")return method==="GET"||method==="POST";
 if(parts.length<5||parts[0]!=="centers"||!UUID.test(parts[1])||
   parts[2]!=="items"||!UUID.test(parts[3]))return false;
 if(parts.length===5&&parts[4]==="history")return method==="GET";
 if(parts.length===5&&parts[4]==="maintenance")return method==="POST";
 if(parts.length===6&&parts[4]==="evidence"&&parts[5]==="current")
  return method==="GET";
 if(parts.length===6&&parts[4]==="evidence"&&parts[5]==="prepare")
  return method==="POST";
 if(parts.length===7&&parts[4]==="evidence"&&UUID.test(parts[5])&&
   parts[6]==="status")return method==="GET";
 if(parts.length===7&&parts[4]==="evidence"&&UUID.test(parts[5])&&
   parts[6]==="confirm")return method==="POST";
 if(parts.length===7&&parts[4]==="evidence"&&parts[5]==="files"&&
   UUID.test(parts[6]))return method==="GET";
 return false;
}
async function request(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allowed(parts,method))
  return fail(404,"This laboratory equipment action is unavailable.");
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit equipment updates through the authorized CareGanga page.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in with your assigned laboratory account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Current laboratory equipment data cannot be verified.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))
    return fail(400,"Check your equipment form.");
   body=JSON.stringify(value);
   if(body.length>6000)return fail(400,"Equipment form is too large.");
  }catch{return fail(400,"Check your equipment form.");}
 }
 try{
  const response=await fetch(new URL(
   "/api/v1/diagnostics/equipment/"+parts.map(encodeURIComponent).join("/"),
   backend),{method,body,cache:"no-store",signal:AbortSignal.timeout(16000),
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})}});
  const pdf=parts.length===7&&parts[5]==="files";
  if(response.ok&&pdf){
   if(response.headers.get("content-type")?.split(";")[0]!=="application/pdf")
    return fail(503,"Private evidence type could not be verified.");
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<5||bytes.byteLength>10485760||
    new TextDecoder().decode(bytes.slice(0,4))!=="%PDF")
    return fail(503,"Original quality PDF could not be verified.");
   return new NextResponse(bytes,{headers:{"Content-Type":"application/pdf",
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
    "Content-Disposition":'attachment; filename="careganga-private-quality.pdf"'}});
  }
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your session expired. Sign in again.":
    status===403?"Your current role or lab assignment does not allow this action.":
    status===404?"The selected original equipment record is unavailable.":
    status===409?"This equipment state changed. Check the original record.":
    status===400?"Check the equipment, proof and calibration details.":
    "This action could not be confirmed. Check the original equipment state.");
  }
  const data:unknown=await response.json().catch(()=>null);
  if(!data||typeof data!=="object")
   return fail(503,"Original laboratory equipment response is unavailable.");
  return NextResponse.json(data,{status:response.status,
   headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{
  return fail(503,"The equipment action outcome is uncertain. Check the original record.");
 }
}
export async function GET(req:NextRequest,{params}:Context){
 return request(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Context){
 return request(req,(await params).parts,"POST");
}
