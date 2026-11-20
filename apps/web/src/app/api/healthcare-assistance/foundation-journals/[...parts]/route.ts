import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allow(parts:string[],method:"GET"|"POST"){
 if(parts.length!==5||parts[0]!=="centers"||!ID.test(parts[1])||
   parts[2]!=="liabilities"||!ID.test(parts[3]))return false;
 return method==="GET"?parts[4]==="options":parts[4]==="post";
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
   if(!raw||typeof raw!=="object"||Array.isArray(raw)||
    Object.keys(raw).length!==4||
    !["requestKey","financialYearRef","expenseAccountRef","liabilityAccountRef"]
      .every(k=>k in raw)||
    !Object.values(raw).every(x=>typeof x==="string"&&ID.test(x)))
    return fail(400,"Select real Foundation accounts and year.");
   body=JSON.stringify(raw);
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
    status===403?"Your current role cannot post Foundation journals.":
    status===404?"The original Foundation obligation is unavailable.":
    status===409?"Original accounts, year or posting changed. Check the journal.":
    status===400?"Select a valid original Foundation expense and payable account.":
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
