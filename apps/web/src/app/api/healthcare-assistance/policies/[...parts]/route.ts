import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function permitted(parts:string[],method:"GET"|"POST"){
 if(method==="GET"&&parts[0]==="centers"){
  if(parts.length===2&&parts[1]==="eligible")return true;
  if(parts.length===2&&ID.test(parts[1]))return true;
  if(parts.length===3&&ID.test(parts[1])&&parts[2]==="doctors")return true;
 }
 if(parts[0]==="reviews"){
  if(parts.length===1)return method==="GET";
  if(parts.length===2&&ID.test(parts[1]))return method==="GET";
  if(parts.length===3&&ID.test(parts[1])&&
    ["decision","activate"].includes(parts[2]))return method==="POST";
 }
 if(method==="POST"&&parts.length===1&&parts[0]==="submit")return true;
 return method==="POST"&&parts.length===2&&
  ID.test(parts[0])&&parts[1]==="withdraw";
}
function fail(status:number,message:string){
 return NextResponse.json({message},{status,
  headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
async function relay(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!permitted(parts,method))return fail(404,"This healthcare policy action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Use the authorized CareGanga policy page to update assistance.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in to manage healthcare assistance.");
 const endpoint=process.env.BACKEND_URL;
 if(!endpoint)return fail(503,"The approved assistance policy source is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))
    return fail(400,"Check the assistance policy form.");
   body=JSON.stringify(value);
   if(body.length>5000)return fail(400,"The assistance policy form is too large.");
  }catch{return fail(400,"Check the assistance policy form.");}
 }
 try{
  const target=parts[0]==="reviews"?
   parts.length===1?"/api/v1/approvals/healthcare-assistance/cases":
   parts.length===2?"/api/v1/approvals/healthcare-assistance/cases/"+parts[1]:
   parts[2]==="decision"?
    "/api/v1/approvals/healthcare-assistance/cases/"+parts[1]+"/decision":
    "/api/v1/healthcare-assistance/policies/cases/"+parts[1]+"/activate":
   "/api/v1/healthcare-assistance/policies/"+parts.map(encodeURIComponent).join("/");
  const response=await fetch(new URL(target,
   endpoint),{method,body,cache:"no-store",signal:AbortSignal.timeout(15000),
    headers:{Authorization:"Bearer "+token,
     ...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your staff session expired. Sign in again.":
    status===403?"Your current role cannot perform this healthcare policy action.":
    status===404?"The currently verified center or doctor is unavailable.":
    status===409?"Policy source or revision changed. Refresh before retrying.":
    status===400?"Check the eligible center, dates and approved cap.":
    "The policy action cannot be confirmed. Check the original policy state.");
  }
  const result:unknown=await response.json().catch(()=>null);
  if(!result||typeof result!=="object")
   return fail(503,"Original healthcare policy result is unavailable.");
  return NextResponse.json(result,{status:response.status,
   headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"Policy outcome uncertain. Check the original record before creating another request.");}
}
export async function GET(req:NextRequest,{params}:Ctx){
 return relay(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Ctx){
 return relay(req,(await params).parts,"POST");
}
