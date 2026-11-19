import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const valid=(p:string[],method:string)=>
 p.length===1&&p[0]==="intents"&&method==="POST"||
 p.length===2&&p[0]==="intents"&&UUID.test(p[1])&&method==="GET"||
 p.length===3&&p[0]==="intents"&&UUID.test(p[1])&&
  p[2]==="confirm"&&method==="POST"||
 p.length===1&&p[0]==="files"&&method==="GET"||
 p.length===3&&p[0]==="files"&&UUID.test(p[1])&&
  p[2]==="download"&&method==="GET"||
 p.length===3&&p[0]==="files"&&UUID.test(p[1])&&
  p[2]==="revoke"&&method==="POST";
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!valid(parts,method))return fail(404,"The private patient file action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit private patient file changes from CareGanga.");
 const token=(await cookies()).get("cg_patient_session")?.value;
 if(!token)return fail(401,"Sign in to your patient account to manage private files.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Private patient files are temporarily unavailable.");
 let payload:string|undefined;
 if(method==="POST"){
  try{
   const body:unknown=await req.json();
   if(!body||typeof body!=="object"||Array.isArray(body))
    throw Error("invalid");
   payload=JSON.stringify(body);
   if(payload.length>2400)throw Error("too large");
  }catch{return fail(400,"Review the private file request before continuing.");}
 }
 const target=new URL("/api/documents/patient-files/"+parts.join("/"),backend);
 if(method==="GET"&&parts.length===1&&parts[0]==="files"){
  const after=req.nextUrl.searchParams.get("after");
  if(after!==null){
   if(after.length>80||!/^[A-Za-z0-9:._-]+$/.test(after))
    return fail(400,"Choose a valid private file history page.");
   target.searchParams.set("after",after);
  }
 }
 try{
  const response=await fetch(target,{
   method,cache:"no-store",body:payload,signal:AbortSignal.timeout(16000),
   headers:{Authorization:"Bearer "+token,
    ...(payload?{"Content-Type":"application/json"}:{})}
  });
  const download=parts.length===3&&parts[0]==="files"&&
   parts[2]==="download";
  if(response.ok&&download){
   const mime=response.headers.get("Content-Type")?.split(";")[0]??"";
   if(!["image/jpeg","image/png","image/webp","application/pdf"].includes(mime))
    return fail(503,"The original private file format is unavailable.");
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length<1||bytes.length>10485760)
    return fail(503,"The private file is too large or unavailable.");
   return new NextResponse(bytes,{status:200,headers:{
    "Content-Type":mime,"Cache-Control":"private, no-store",
    "Content-Disposition":'attachment; filename="CareGanga-private-patient-file"',
    "X-Content-Type-Options":"nosniff"
   }});
  }
  const raw:unknown=await response.json().catch(()=>null);
  if(!response.ok){
   const status=[400,401,403,404,409,429].includes(response.status)?
    response.status:503;
   return fail(status,status===401?"Your patient session expired. Sign in again.":
    status===403||status===404?
     "This private file is unavailable to your verified patient account.":
    status===409?"The original file changed. Refresh its status before retrying.":
    status===429?"Too many file requests. Try again later.":
    status===400?"Check file type, size or original request.": 
    "The original secure file result is uncertain. Check its current status.");
  }
  return NextResponse.json(raw,{status:200,
   headers:{"Cache-Control":"private, no-store"}});
 }catch{return fail(503,"Private file status is uncertain. Check the original upload before retrying.");}
}
export async function GET(req:NextRequest,ctx:Ctx){
 return forward(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Ctx){
 return forward(req,(await ctx.params).parts,"POST");
}
