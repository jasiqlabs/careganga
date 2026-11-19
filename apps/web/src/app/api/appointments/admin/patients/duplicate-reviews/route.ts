import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const BAD=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
async function forward(req:NextRequest,method:"GET"|"POST"){
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return BAD(403,"Submit the protected patient review from CareGanga.");
 const bearer=(await cookies()).get("cg_staff_session")?.value;
 if(!bearer)return BAD(401,"Sign in to the authorized Foundation account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return BAD(503,"Protected patient review is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const v:unknown=await req.json();
   if(!v||typeof v!=="object"||Array.isArray(v))throw Error("body");
   const input=v as Record<string,unknown>;
   if(Object.keys(input).some(k=>!["requestKey","sourceVirtualPatientId",
    "canonicalVirtualPatientId","possibleDuplicateConfirmed"].includes(k)))
    throw Error("fields");
   body=JSON.stringify(input);
   if(body.length>500)throw Error("large");
  }catch{return BAD(400,"Review the original Virtual Patient IDs before submitting.");}
 }
 if(req.nextUrl.searchParams.size>0)return BAD(400,"Unexpected review query.");
 try{
  const result=await fetch(new URL(
   "/api/v1/appointments/admin/patients/duplicate-reviews",backend),{
   method,body,cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+bearer,
    ...(body?{"Content-Type":"application/json"}:{})}});
  if(!result.ok){
   const code=[400,401,403,404,409,429].includes(result.status)?result.status:503;
   return BAD(code,code===401?"Protected account sign-in expired.":
    code===403?"Your role cannot review duplicate patient identities.":
    code===409?"This possible duplicate is already under review or changed.":
    code===400?"Check the patient references and try again.":
    "The original restricted review result is uncertain. Refresh before retrying.");
  }
  return NextResponse.json(await result.json() as unknown,{
   headers:{"Cache-Control":"private, no-store"}});
 }catch{return BAD(503,"The review result is uncertain. Check the original inbox.");}
}
export async function GET(req:NextRequest){return forward(req,"GET");}
export async function POST(req:NextRequest){return forward(req,"POST");}
