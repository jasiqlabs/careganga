import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allowed(parts:string[],method:"GET"|"POST"){
 if(parts[0]==="staff"&&parts.length>=5&&parts[1]==="centers"&&
  ID.test(parts[2])&&parts[3]==="collections"&&ID.test(parts[4])){
  if(parts.length===5&&method==="GET")return {ok:true,pdf:false};
  if(parts.length===6&&parts[5]==="issue"&&method==="POST")
   return {ok:true,pdf:false};
  if(parts.length===6&&parts[5]==="pdf"&&method==="GET")
   return {ok:true,pdf:true};
 }
 if(parts[0]==="me"&&parts.length>=5&&parts[1]==="appointments"&&
  ID.test(parts[2])&&parts[3]==="collections"&&ID.test(parts[4])){
  if(parts.length===5&&method==="GET")return {ok:true,pdf:false};
  if(parts.length===6&&["pdf","online-pdf"].includes(parts[5])&&method==="GET")
   return {ok:true,pdf:true};
 }
 return {ok:false,pdf:false};
}
const fail=(code:number,message:string)=>NextResponse.json({message},{
 status:code,headers:{"Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 const match=allowed(parts,method);
 if(!match.ok)return fail(404,"Original center receipt action unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Use your authenticated center page to issue a receipt.");
 const session=(await cookies()).get(parts[0]==="staff"?
  "cg_staff_session":"cg_patient_session")?.value;
 if(!session)return fail(401,"Sign in to see your private center receipt.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Protected receipt source is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).length!==1||!("requestKey" in raw)||
    typeof raw.requestKey!=="string"||!ID.test(raw.requestKey))
    return fail(400,"Check the original receipt request.");
   body=JSON.stringify(raw);
  }catch{return fail(400,"Invalid receipt issuance request.");}
 }
 try{
  const response=await fetch(new URL(
   "/api/v1/healthcare-assistance/center-receipts/"+parts.join("/"),backend),{
    method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
    headers:{Authorization:"Bearer "+session,...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your session has expired. Sign in again.":
    status===403?"You cannot access this center's receipt.":
    status===404?"The original verified receipt is not available.":
    status===409?"The original receipt changed; review its current state.":
    status===400?"Receipt request is invalid.":
    "Private receipt outcome is uncertain. Check the original status.");
  }
  if(match.pdf){
   if(!(response.headers.get("content-type")??"").startsWith("application/pdf"))
    return fail(503,"The protected receipt format is unavailable.");
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength<100||bytes.byteLength>10485760)
    return fail(503,"The protected receipt size could not be verified.");
   return new NextResponse(bytes,{status:200,headers:{
    "Content-Type":"application/pdf","Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
    "Content-Disposition":parts[5]==="online-pdf"?'attachment; filename="careganga-online-payment-confirmation.pdf"':'attachment; filename="careganga-center-cash-receipt.pdf"'}});
  }
  const value:unknown=await response.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value))
   return fail(503,"Original receipt status cannot be verified.");
  return NextResponse.json(value,{headers:{
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"Receipt outcome unknown. Check the original collection before retrying.");}
}
export async function GET(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"POST");
}
