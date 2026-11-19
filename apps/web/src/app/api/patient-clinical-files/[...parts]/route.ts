import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function patient(parts:string[],method:string){
 return parts.length===4&&parts[0]==="me"&&parts[1]==="files"&&
  ID.test(parts[2])&&parts[3]==="shares"&&["GET","POST"].includes(method)||
  parts.length===4&&parts[0]==="me"&&parts[1]==="shares"&&
  ID.test(parts[2])&&parts[3]==="revoke"&&method==="POST";
}
function staff(parts:string[],method:string){
 return method==="GET"&&(
  parts.length===5&&parts[0]==="centers"&&ID.test(parts[1])&&
   parts[2]==="bookings"&&ID.test(parts[3])&&parts[4]==="files"||
  parts.length===7&&parts[0]==="centers"&&ID.test(parts[1])&&
   parts[2]==="bookings"&&ID.test(parts[3])&&parts[4]==="files"&&
   ID.test(parts[5])&&parts[6]==="download");
}
const fail=(status:number,message:string)=>NextResponse.json({message},
 {status,headers:{"Cache-Control":"private, no-store"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 const own=patient(parts,method),clinical=staff(parts,method);
 if(!own&&!clinical)return fail(404,"That private patient document action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Make private changes from the CareGanga application.");
 const token=(await cookies()).get(own?"cg_patient_session":"cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in using your current authorized account.");
 const server=process.env.BACKEND_URL;
 if(!server)return fail(503,"Private clinical document service is unavailable.");
 let payload:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("bad");
   payload=JSON.stringify(raw);
   if(payload.length>500)throw Error("large");
  }catch{return fail(400,"Check the original selected patient file and appointment.");}
 }
 try{
  const path="/api/documents/patient-clinical/"+parts.join("/");
  const response=await fetch(new URL(path,server),{
   method,body:payload,cache:"no-store",signal:AbortSignal.timeout(18000),
   headers:{Authorization:"Bearer "+token,...(payload?{"Content-Type":"application/json"}:{})}
  });
  const download=clinical&&parts[6]==="download";
  if(response.ok&&download){
   const mime=response.headers.get("Content-Type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))
    return fail(503,"The original private document format is unavailable.");
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<1||bytes.length>10485760)
    return fail(503,"The original protected file cannot be verified.");
   return new NextResponse(bytes,{status:200,headers:{
    "Content-Type":mime,
    "Content-Disposition":'attachment; filename="CareGanga-patient-provided-file"',
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff"
   }});
  }
  const result:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Session expired. Sign in again.":
    status===403||status===404?
     "You do not have current patient or clinician permission for this file.":
    status===409?"This document permission changed. Refresh its current status.":
    status===400?"Select your original appointment and scanned file.":
    status===429?"Too many requests. Try again later.":
    "The private document result is uncertain. Check its current status.");
  }
  return NextResponse.json(result,{status:response.status,
   headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return fail(503,"The clinical document result is uncertain. Refresh before retrying.");
 }
}
export async function GET(req:NextRequest,ctx:Ctx){
 return forward(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Ctx){
 return forward(req,(await ctx.params).parts,"POST");
}
