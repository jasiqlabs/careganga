import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{action:string}>};
const errors=new Set([
 "CG17_PARTNER_CLAIM_INVALID","CG17_PARTNER_CLAIM_PROOF_REQUIRED",
 "CG17_PARTNER_CLAIM_PATIENT_UNAVAILABLE","CG17_PARTNER_CLAIM_DUPLICATE_INVOICE",
 "CG17_PARTNER_CLAIM_REQUEST_CONFLICT","CG17_PARTNER_CLAIM_POLICY_UNAVAILABLE",
 "CG17_PARTNER_CLAIM_CENTER_UNAVAILABLE","CG17_PARTNER_CLAIM_LIST_LIMIT",
 "CG17_PARTNER_CLAIM_SOURCE_FROZEN","CG14_CENTER_SERVICE_NOT_VERIFIED"
]);
const reply=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
async function handle(req:NextRequest,method:"GET"|"POST",ctx:Context){
 const {action}=await ctx.params;
 if(!["mine","eligible-services"].includes(action)||
    method==="POST"&&action!=="mine")
  return reply(404,"This patient claim action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply(403,"Submit the claim from your signed-in CareGanga page.");
 const token=(await cookies()).get("cg_patient_session")?.value;
 if(!token)return reply(401,"Sign in to your verified patient profile.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply(503,"Partner claim records are temporarily unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const json:unknown=await req.json();
   if(!json||typeof json!=="object"||Array.isArray(json))
    throw Error("invalid");
   const keys=Object.keys(json);
   if(keys.length<7||keys.length>9||
     keys.some(k=>!["requestKey","centerRef","serviceKind","invoiceNumber",
      "serviceDate","invoiceFileRef","completionFileRef","paymentFileRef","grossMinor"].includes(k)))
    throw Error("invalid");
   body=JSON.stringify(json);
   if(body.length>2000)throw Error("invalid");
  }catch{return reply(400,"Check the invoice, verified documents and service details.");}
 }
 try{
  const result=await fetch(new URL(
   "/api/v1/healthcare-assistance/partner-claims/"+action,backend),{
   method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}
  });
  if(!result.ok){
   const status=[400,401,403,404,409,429].includes(result.status)?
    result.status:503;
   const raw:unknown=await result.json().catch(()=>null);
   const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?
    raw as Record<string,unknown>:null;
   const message=obj&&typeof obj.code==="string"&&errors.has(obj.code)&&
    typeof obj.message==="string"&&obj.message.length>=16&&
    obj.message.length<=220&&!/[<>\r\n]/.test(obj.message)?obj.message:
    status===401?"Your session expired. Sign in again.":
    status===403?"Your account cannot submit this claim.":
    status===404?"Your verified patient profile or this service is unavailable.":
    status===409?"The original claim or provider changed. Refresh before retrying.":
    status===429?"Too many attempts. Try again later.":
    status===400?"Check the original invoice and service details.":
    "The claim outcome could not be confirmed. Check your original history.";
   return reply(status,message);
  }
  const value:unknown=await result.json();
  if(!value||typeof value!=="object"||Array.isArray(value))
   return reply(503,"The patient claim response cannot be verified.");
  return NextResponse.json(value,{headers:{"Cache-Control":"private, no-store"}});
 }catch{return reply(503,
  "The claim result is uncertain. Check your original history before retrying.");}
}
export async function GET(req:NextRequest,ctx:Context){return handle(req,"GET",ctx)}
export async function POST(req:NextRequest,ctx:Context){return handle(req,"POST",ctx)}
