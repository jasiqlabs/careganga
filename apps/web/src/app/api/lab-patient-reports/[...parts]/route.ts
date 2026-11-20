import {NextRequest,NextResponse} from "next/server";
import {cookies} from "next/headers";
export const dynamic="force-dynamic";
type C={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store",
 "X-Content-Type-Options":"nosniff"}});
export async function GET(req:NextRequest,{params}:C){
 const p=(await params).parts;
 const list=p.length===1&&p[0]==="me";
 const pdf=p.length===3&&p[0]==="me"&&ID.test(p[1])&&p[2]==="pdf";
 if(!list&&!pdf)return fail(404,"The patient report action is unavailable.");
 const token=(await cookies()).get("cg_patient_session")?.value;
 if(!token)return fail(401,"Sign in to your private patient account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Private lab reports are temporarily unavailable.");
 try{
  const response=await fetch(new URL(
   "/api/v1/diagnostics/patient-reports/"+p.join("/"),backend),{
    method:"GET",cache:"no-store",signal:AbortSignal.timeout(18000),
    headers:{Authorization:"Bearer "+token}});
  if(!response.ok)return fail(
   [401,403,404,409,429].includes(response.status)?response.status:503,
   response.status===401?"Please sign in again.":
   "This released report is unavailable for the current patient account.");
  if(pdf){
   if(response.headers.get("Content-Type")?.split(";")[0]!=="application/pdf")
    return fail(503,"Protected PDF format unavailable.");
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.byteLength<5||bytes.byteLength>10485760||
     new TextDecoder().decode(bytes.slice(0,4))!=="%PDF")
    return fail(503,"The private report PDF cannot be verified.");
   return new NextResponse(bytes,{headers:{
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
    "Content-Type":"application/pdf",
    "Content-Disposition":'attachment; filename="careganga-lab-report.pdf"'}});
  }
  const value:unknown=await response.json().catch(()=>null);
  if(!value||typeof value!=="object"||Array.isArray(value)||
    !("reports" in value)||!Array.isArray(value.reports))
   return fail(503,"Released report listing is unavailable.");
  return NextResponse.json(value,{headers:{"Cache-Control":"private, no-store"}});
 }catch{return fail(503,"Private patient report status is unavailable.");}
}
