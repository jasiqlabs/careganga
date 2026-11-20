import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type C={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const error=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"no-store"}});
function allowed(parts:string[],method:string){
 if(parts.length===2&&parts[0]==="centers"&&parts[1]==="eligible")
  return method==="GET";
 if(parts.length===4&&parts[0]==="centers"&&UUID.test(parts[1])&&
    ["patients","catalog"].includes(parts[2])&&parts[3]==="eligible")
  return method==="GET";
 if(parts.length===3&&parts[0]==="centers"&&
    UUID.test(parts[1])&&parts[2]==="orders")
  return method==="GET"||method==="POST";
 if(parts.length===7&&parts[0]==="centers"&&UUID.test(parts[1])&&
    parts[2]==="orders"&&UUID.test(parts[3])&&parts[4]==="samples"&&
    UUID.test(parts[5])&&["collect","receive","start-processing","reject","recollect"].includes(parts[6]))
  return method==="POST";
 if(parts.length===6&&parts[0]==="centers"&&UUID.test(parts[1])&&
   parts[2]==="orders"&&UUID.test(parts[3])&&parts[4]==="reports"&&
   parts[5]==="prepare")return method==="POST";
 if(parts.length===7&&parts[0]==="centers"&&UUID.test(parts[1])&&
   parts[2]==="orders"&&UUID.test(parts[3])&&parts[4]==="reports"&&
   UUID.test(parts[5])&&parts[6]==="confirm")return method==="POST";
 if(parts.length===7&&parts[0]==="centers"&&UUID.test(parts[1])&&
   parts[2]==="orders"&&UUID.test(parts[3])&&parts[4]==="reports"&&
   UUID.test(parts[5])&&parts[6]==="status")return method==="GET";
 if(parts.length===4&&parts[0]==="centers"&&UUID.test(parts[1])&&
    parts[2]==="orders"&&UUID.test(parts[3]))return method==="GET";
 return false;
}
async function request(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allowed(parts,method))return error(404,"This clinical laboratory action is not available.");
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return error(403,"Submit the lab order from CareGanga.");
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return error(401,"Sign in with an authorized laboratory account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return error(503,"Clinical operations cannot currently be verified.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))
    return error(400,"Check the laboratory order form.");
   body=JSON.stringify(value);
   if(body.length>12000)return error(400,"The laboratory order is too large.");
  }catch{return error(400,"Check the laboratory order form.");}
 }
 try{
  const response=await fetch(
   new URL("/api/v1/diagnostics/clinical/"+parts.map(encodeURIComponent).join("/"),backend),{
    method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
    headers:{Authorization:"Bearer "+session,
     ...(body?{"Content-Type":"application/json"}:{})}
   });
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return error(status,status===403?
    "This laboratory, patient or action is not currently authorized.":
    status===409?"This order has changed. Refresh the original order before retrying.":
    status===404?"The selected current clinical record is unavailable.":
    status===400?"Check the patient, consent and selected test details.":
    status===401?"Your session is no longer valid. Sign in again.":
    "Clinical operations cannot currently be confirmed. Check for a saved order before retrying.");
  }
  return NextResponse.json(raw,{status:response.status,
   headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return error(503,"The order result is uncertain. Check the original records before retrying.");}
}
export async function GET(req:NextRequest,{params}:C){
 return request(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:C){
 return request(req,(await params).parts,"POST");
}
