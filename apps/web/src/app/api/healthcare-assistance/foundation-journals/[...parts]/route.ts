import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allow(parts:string[],method:"GET"|"POST"){
 if(parts.length!==5||parts[0]!=="centers"||!ID.test(parts[1])||
   parts[2]!=="liabilities"||!ID.test(parts[3]))return false;
 return method==="GET"?["options","correction-options"].includes(parts[4]):
  ["post","reverse"].includes(parts[4]);
}
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store",
 "X-Content-Type-Options":"nosniff"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allow(parts,method))return fail(404,"Original journal source unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Use your protected Foundation accounting page.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in with your authorized Foundation account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Original CG09 journal source is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))
    return fail(400,"Invalid protected Foundation journal request.");
   const v=raw as Record<string,unknown>;
   if(parts[4]==="post"){
    if(Object.keys(v).length!==4||
     !["requestKey","financialYearRef","expenseAccountRef","liabilityAccountRef"]
      .every(k=>k in v)||
     !Object.values(v).every(x=>typeof x==="string"&&ID.test(x)))
     return fail(400,"Select real Foundation accounts and year.");
   }else{
    if(Object.keys(v).length!==5||
     !["requestKey","financialYearRef","postingDate","reason","currentPassword"]
      .every(k=>k in v)||
     typeof v.requestKey!=="string"||!ID.test(v.requestKey)||
     typeof v.financialYearRef!=="string"||!ID.test(v.financialYearRef)||
     typeof v.postingDate!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v.postingDate)||
     typeof v.reason!=="string"||v.reason.trim().length<12||
     v.reason.trim().length>300||
     typeof v.currentPassword!=="string"||v.currentPassword.length<8||
     v.currentPassword.length>1024)
     return fail(400,"Review the date, reason and password confirmation.");
   }
   body=JSON.stringify(v);
  }catch{return fail(400,"Invalid original posting details.");}
 }
 try{
  const response=await fetch(new URL(
   "/api/v1/healthcare-assistance/foundation-journals/"+parts.join("/"),backend),{
    method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
    headers:{Authorization:"Bearer "+token,
     ...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your session expired. Sign in again.":
    status===403?"Your current role cannot perform this protected accounting action.":
    status===404?"The original Foundation obligation is unavailable.":
    status===409?"The original financial source changed or requires a separate reconciliation. Check its current status.":
    status===400?"Check the original accounting details and correction proof.":
    "Posting outcome uncertain. Recheck the original journal before retrying.");
  }
  const data:unknown=await response.json().catch(()=>null);
  if(!data||typeof data!=="object"||Array.isArray(data))
   return fail(503,"Original CG09 journal outcome cannot be verified.");
  return NextResponse.json(data,{headers:{
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"Journal outcome uncertain. Check original source before re-posting.");}
}
export async function GET(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"POST");
}
