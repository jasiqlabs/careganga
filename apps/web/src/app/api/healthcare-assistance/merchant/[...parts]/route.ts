import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allowed(p:string[],method:"GET"|"POST"){
 if(p[0]==="me"&&p[1]==="appointments"&&ID.test(p[2]??"")){
  if(p.length===3)return method==="GET";
  if(p.length===4&&["checkout","reconcile"].includes(p[3]))return method==="POST";
 }
 if(p[0]==="staff"&&p[1]==="centers"&&ID.test(p[2]??"")){
  if(p.length===4&&p[3]==="binding")return method==="GET";
  if(p.length===5&&p[3]==="binding"&&
   ["propose","verify","revoke"].includes(p[4]))
   return method==="POST";
  if(p.length===5&&p[3]==="appointments"&&ID.test(p[4]))
   return method==="GET";
  if(p.length===6&&p[3]==="appointments"&&ID.test(p[4])&&
    ["checkout","reconcile"].includes(p[5]))return method==="POST";
 }
 return false;
}
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store",
  "X-Content-Type-Options":"nosniff"}
});
async function relay(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allowed(parts,method))return fail(404,"This center payment action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Use the verified CareGanga payment screen.");
 const session=(await cookies()).get(parts[0]==="staff"?
  "cg_staff_session":"cg_patient_session")?.value;
 if(!session)return fail(401,"Sign in to review your private healthcare payment.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Verified center payment service is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const input:unknown=await req.json();
   if(!input||typeof input!=="object"||Array.isArray(input))
    return fail(400,"Check the original payment details.");
   body=JSON.stringify(input);
   if(body.length>1500)return fail(400,"Payment request is too large.");
  }catch{return fail(400,"Check the original payment details.");}
 }
 try{
  const response=await fetch(new URL(
   "/api/v1/healthcare-assistance/merchant/"+parts.join("/"),backend),{
    method,body,cache:"no-store",signal:AbortSignal.timeout(16000),
    headers:{Authorization:"Bearer "+session,
     ...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your session has expired. Sign in.":
    status===403?"This verified center is not authorized for your account.":
    status===404?"Original booking or merchant source unavailable.":
    status===409?"Payment or merchant source changed. Check the original record.":
    status===400?"Invalid original amount, merchant or request.":
    "Provider outcome uncertain. Check the same order before retrying.");
  }
  const value:unknown=await response.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value))
   return fail(503,"The original provider result could not be verified.");
  return NextResponse.json(value,{status:response.status,
   headers:{"Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"Provider status uncertain. Check the same payment order.");}
}
export async function GET(req:NextRequest,{params}:Ctx){
 return relay(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Ctx){
 return relay(req,(await params).parts,"POST");
}
