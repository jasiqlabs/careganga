import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function route(parts:string[],method:"GET"|"POST"){
 if(parts.length===3&&parts[0]==="me"&&parts[1]==="appointments"&&
    ID.test(parts[2])&&method==="GET")return true;
 if(parts.length===5&&parts[0]==="staff"&&parts[1]==="centers"&&
  ID.test(parts[2])&&parts[3]==="charges"&&ID.test(parts[4])&&
  method==="GET")return true;
 if(parts.length===6&&parts[0]==="staff"&&parts[1]==="centers"&&
  ID.test(parts[2])&&parts[3]==="charges"&&ID.test(parts[4])&&
  parts[5]==="record"&&method==="POST")return true;
 return parts.length===6&&parts[0]==="staff"&&parts[1]==="centers"&&
  ID.test(parts[2])&&parts[3]==="collections"&&ID.test(parts[4])&&
  parts[5]==="refund"&&method==="POST";
}
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!route(parts,method))return fail(404,"Patient collection action unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit payment records from the protected CareGanga center page.");
 const token=(await cookies()).get(parts[0]==="staff"?
  "cg_staff_session":"cg_patient_session")?.value;
 if(!token)return fail(401,"Sign in to your authorized CareGanga account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"The original collection source is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const v:unknown=await req.json();
   if(!v||typeof v!=="object"||Array.isArray(v))
    return fail(400,"Check cash receipt and payment amount.");
   body=JSON.stringify(v);
   if(body.length>1600)return fail(400,"Payment record is too large.");
  }catch{return fail(400,"Check the payment record.");}
 }
 try{
  const response=await fetch(new URL(
   "/api/v1/healthcare-assistance/center-collections/"+parts.join("/"),backend),{
    method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
    headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your session expired. Sign in again.":
    status===403?"Your current center or cashier role does not permit this payment.":
    status===404?"This center's accepted patient charge is unavailable.":
    status===409?"A receipt or original due amount has changed. Recheck before retrying.":
    status===400?"Check the amount, receipt number and cash attestation.":
    "Collection outcome uncertain. Check the original payment history.");
  }
  const value:unknown=await response.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value))
   return fail(503,"The original collection response cannot be verified.");
  return NextResponse.json(value,{headers:{
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"Collection status uncertain. Check this original charge before another attempt.");}
}
export async function GET(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"POST");
}
