import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import {isAllowedOrigin} from "../../../../shared/request-origin";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
type Method="GET"|"POST"|"PUT";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function permitted(parts:string[],method:Method){
 if(parts.length===1&&["team-sources","notice-sources","project-sources","event-sources","partner-sources","campaign-sources","beneficiary-impact-source"].includes(parts[0]))return method==="GET";
 if(parts[0]==="pages"){
  if(parts.length===1)return method==="GET"||method==="POST";
  if(parts.length===2&&UUID.test(parts[1]))return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])){
   if(["preview"].includes(parts[2]))return method==="GET";
   if(parts[2]==="draft")return method==="PUT";
   return ["submit","publish","withdraw"].includes(parts[2])&&method==="POST";
  }
 }
 if(parts[0]==="reviews"){
  if(parts.length===1)return method==="GET";
  if(parts.length===2&&UUID.test(parts[1]))return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])&&parts[2]==="decide")
   return method==="POST";
 }
 if(parts[0]==="media"){
  if(parts.length===2&&parts[1]==="initiate")return method==="POST";
  if(parts.length===2&&UUID.test(parts[1]))return method==="GET";
  if(parts.length===3&&UUID.test(parts[1])&&parts[2]==="confirm")
   return method==="POST";
 }
 return false;
}
function fail(status:number,message:string){
 return NextResponse.json({message},{status,headers:{"Cache-Control":"private, no-store"}});
}
async function handler(request:NextRequest,ctx:Ctx,method:Method){
 const parts=(await ctx.params).parts;
 if(!permitted(parts,method))return fail(404,"Website content action unavailable.");
 if(method!=="GET"&&!isAllowedOrigin(request))
  return fail(403,"Submit changes from the original CareGanga page.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in to manage the website.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Website content service is unavailable.");
 let body:string|undefined;
 if(method!=="GET"){
  const size=Number(request.headers.get("content-length")??0);
  if(!Number.isFinite(size)||size>64000)
   return fail(413,"Website content is too large.");
  try{
   const input:unknown=await request.json();
   if(!input||typeof input!=="object"||Array.isArray(input))throw Error();
   body=JSON.stringify(input);
   if(body.length>64000)throw Error();
  }catch{return fail(400,"Check the content you entered.");}
 }
 try{
  const url=new URL("/api/cms/"+parts.map(x=>encodeURIComponent(x)).join("/"),backend);
  if(method==="GET"&&parts[0]==="reviews"){
   const offset=request.nextUrl.searchParams.get("offset");
   if(offset&&/^(0|[1-9][0-9]{0,4})$/.test(offset))
    url.searchParams.set("offset",offset);
  }
  const res=await fetch(url,{method,cache:"no-store",
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
   body,signal:AbortSignal.timeout(15000)});
  const status=[200,201,202,400,401,403,404,409,413,429].includes(res.status)?
   res.status:503;
  if(!res.ok){
   // CG21 controls safe, editable server error copy; do not overwrite it
   // with a fixed Web-only message. Reject malformed/private error payloads.
   const original:unknown=await res.json().catch(()=>null);
   const safe=original&&typeof original==="object"&&!Array.isArray(original)&&
    "message" in original&&typeof original.message==="string"&&
    original.message.length>=8&&original.message.length<=240&&
    !/[<>\u0000-\u001f\u007f]/.test(original.message)
     ?original.message:null;
   if(safe)return fail(status,safe);
   return fail(status,status===401?"Sign in again to continue.":
    status===403?"Your current role cannot perform that website action.":
    status===404?"The page or review is unavailable.":
    status===409?"The page or review changed. Refresh before retrying.":
    "Website content could not be confirmed. Check the original status before retrying.");
  }
  const data:unknown=await res.json().catch(()=>null);
  if(!data||typeof data!=="object"||Array.isArray(data))
   return fail(503,"Website content returned an invalid result.");
  return NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store",
   "X-Content-Type-Options":"nosniff"}});
 }catch{return fail(503,"Website content could not be reached. Check current status before retrying.");}
}
export function GET(req:NextRequest,ctx:Ctx){return handler(req,ctx,"GET");}
export function POST(req:NextRequest,ctx:Ctx){return handler(req,ctx,"POST");}
export function PUT(req:NextRequest,ctx:Ctx){return handler(req,ctx,"PUT");}
