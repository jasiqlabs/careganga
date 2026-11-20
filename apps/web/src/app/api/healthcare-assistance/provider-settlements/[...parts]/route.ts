import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MONTH=/^20[2-9]\d-(0[1-9]|1[0-2])$/;
const fail=(code:number,message:string)=>NextResponse.json({message},{
 status:code,headers:{"Cache-Control":"private, no-store",
 "X-Content-Type-Options":"nosniff"}});
function permitted(p:string[],method:"GET"|"POST"){
 if(method==="GET"&&p.length===2&&p[0]==="centers"&&p[1]==="eligible")
  return true;
 if(p.length>=4&&p[0]==="centers"&&ID.test(p[1])&&
  p[2]==="months"&&MONTH.test(p[3])){
  return method==="GET"?p.length===4||
   (p.length===5&&p[4]==="payout-options"):
   p.length===5&&["propose","review","confirm-payout"].includes(p[4]);
 }
 return false;
}
async function proxy(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!permitted(parts,method))return fail(404,"Original settlement action unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Use the authorized Foundation settlement page.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in to your Foundation account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Original Foundation settlement source unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    !("requestKey" in raw)||typeof raw.requestKey!=="string"||
    !ID.test(raw.requestKey))return fail(400,"Invalid original settlement request.");
   const review=parts[4]==="review",payout=parts[4]==="confirm-payout";
   if(payout){
    if(Object.keys(raw).length!==3||!("bankMatchRef" in raw)||
     typeof raw.bankMatchRef!=="string"||!ID.test(raw.bankMatchRef)||
     !("payeeMatched" in raw)||raw.payeeMatched!==true)
     return fail(400,"Match the actual verified bank payment and protected beneficiary.");
   }else if(Object.keys(raw).length!==(review?2:1)||
    (review&&(!("expectedRevision" in raw)||
     !Number.isSafeInteger(raw.expectedRevision)||Number(raw.expectedRevision)<1)))
    return fail(400,"Review the original claim and expected revision.");
   body=JSON.stringify(raw);
  }catch{return fail(400,"Invalid original settlement request.");}
 }
 try{
  const response=await fetch(new URL(
   "/api/v1/healthcare-assistance/provider-settlements/"+parts.join("/"),backend),{
    method,cache:"no-store",body,signal:AbortSignal.timeout(14000),
    headers:{Authorization:"Bearer "+token,
     ...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Session expired; sign in again.":
    status===403?"Your current role cannot perform this settlement action.":
    status===404?"Original posted liabilities or verified center unavailable.":
    status===409?"Claim or bank proof changed. Recheck the original source.":
    status===400?"Select the correct month and original posted liabilities.":
    "Settlement claim outcome uncertain. Check before retrying.");
  }
  const value:unknown=await response.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value))
   return fail(503,"Settlement source state could not be verified.");
  return NextResponse.json(value,{headers:{"Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"Original settlement outcome unknown; refresh before retrying.");}
}
export async function GET(req:NextRequest,{params}:Context){
 return proxy(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Context){
 return proxy(req,(await params).parts,"POST");
}
