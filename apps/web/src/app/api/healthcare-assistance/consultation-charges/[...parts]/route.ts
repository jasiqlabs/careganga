import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function permitted(p:string[],m:"GET"|"POST"){
 if(p[0]==="me"){
  if(m==="GET"&&p.length===4&&p[1]==="holds"&&
    ID.test(p[2])&&p[3]==="quote")return true;
  if(p.length===3&&p[1]==="appointments"&&ID.test(p[2]))
   return m==="GET";
  if(p.length===4&&p[1]==="appointments"&&ID.test(p[2])&&
    p[3]==="accept")return m==="POST";
 }
 if(p[0]==="staff"&&p.length>=5&&p[1]==="centers"&&ID.test(p[2])){
  if(m==="GET"&&p.length===6&&p[3]==="holds"&&
    ID.test(p[4])&&p[5]==="quote")return true;
  if(p.length===5&&p[3]==="appointments"&&ID.test(p[4]))
   return m==="GET";
  if(p.length===6&&p[3]==="appointments"&&ID.test(p[4])&&
    p[5]==="accept")return m==="POST";
 }
 return false;
}
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}
});
async function forward(req:NextRequest,p:string[],method:"GET"|"POST"){
 if(!permitted(p,method))
  return fail(404,"This consultation contribution action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit your consultation contribution from CareGanga.");
 const token=(await cookies()).get(p[0]==="staff"?
  "cg_staff_session":"cg_patient_session")?.value;
 if(!token)return fail(401,"Sign in using your authorized CareGanga account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"The original consultation contribution is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const v:unknown=await req.json();
   if(!v||typeof v!=="object"||Array.isArray(v))
    return fail(400,"Review the exact consultation and amounts.");
   body=JSON.stringify(v);
   if(body.length>1400)return fail(400,"The contribution request is too large.");
  }catch{return fail(400,"Check the consultation contribution details.");}
 }
 try{
  const response=await fetch(new URL(
   "/api/v1/healthcare-assistance/consultation-charges/"+p.join("/"),
   backend),{method,body,cache:"no-store",signal:AbortSignal.timeout(13000),
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})}});
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your patient or staff session expired. Sign in.":
    status===403?"You are not allowed to view or accept this appointment contribution.":
    status===404?"The original consultation is not available to your account.":
    status===409?"The appointment, approved fee or assistance changed. Refresh the original quote.":
    status===400?"Please review the fee, cap and patient amount.":
    "The contribution outcome is uncertain. Check the original appointment.");
  }
  const v:unknown=await response.json().catch(()=>null);
  if(!v||typeof v!=="object"||Array.isArray(v))
   return fail(503,"The original contribution response is unavailable.");
  return NextResponse.json(v,{
   headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"The contribution status is uncertain. Check the original appointment before retrying.");}
}
export async function GET(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"GET");
}
export async function POST(req:NextRequest,{params}:Ctx){
 return forward(req,(await params).parts,"POST");
}
