import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"no-store"}
});
function allowed(parts:string[],method:"GET"|"POST"){
 if(parts.length===1&&parts[0]==="intents"&&method==="POST")return true;
 if(parts.length===2&&parts[0]==="intents"&&UUID.test(parts[1])&&method==="GET")
  return true;
 if(parts.length===3&&parts[0]==="intents"&&UUID.test(parts[1])&&
  parts[2]==="confirm"&&method==="POST")return true;
 if(parts.length===3&&parts[0]==="centers"&&UUID.test(parts[1])&&
  parts[2]==="files"&&method==="GET")return true;
 if(parts.length===3&&parts[0]==="files"&&UUID.test(parts[1])&&
  ["attest","revoke","revoke-rights"].includes(parts[2])&&method==="POST")
  return true;
 return false;
}
async function handler(req:NextRequest,ctx:Ctx,method:"GET"|"POST"){
 const parts=(await ctx.params).parts;
 if(!allowed(parts,method))return fail(404,"Private photo action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Use the original CareGanga center screen.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in to manage private center photos.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Verified center photo service is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error();
   body=JSON.stringify(raw);
   if(body.length>1800)throw Error();
  }catch{return fail(400,"Check the photo or publication-rights information.");}
 }
 try{
  const target=new URL("/api/documents/health-center-content/"+parts.join("/"),backend);
  const result=await fetch(target,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})}});
  if(!result.ok){
   const status=[400,401,403,404,409,413,429].includes(result.status)?
    result.status:503;
   const raw:unknown=await result.json().catch(()=>null);
   const permitted=new Set([
    "HEALTH_CENTER_MEDIA_INVALID","HEALTH_CENTER_MEDIA_SOURCE_CHANGED",
    "HEALTH_CENTER_MEDIA_REQUEST_CONFLICT","HEALTH_CENTER_MEDIA_RIGHTS_INVALID",
    "HEALTH_CENTER_MEDIA_RIGHTS_CHANGED","HEALTH_CENTER_MEDIA_NOT_VERIFIED"
   ]);
   if(status<500&&raw&&typeof raw==="object"&&"code" in raw&&
     typeof raw.code==="string"&&permitted.has(raw.code)&&
     "message" in raw&&typeof raw.message==="string"&&
     raw.message.length>=16&&raw.message.length<=240&&
     !/[<>\u0000-\u001f\u007f]/.test(raw.message))
    return NextResponse.json({code:raw.code,message:raw.message},{
     status,headers:{"Cache-Control":"no-store"}});
   return fail(status,status===401?"Sign in to continue.":
    status===403?"You cannot manage files for this center.":
    status===409?"This file or center draft changed. Refresh original status.":
    status===404?"This original center photo is unavailable.":
    status===400?"Check your file details and publication rights.":
    "Secure photo status could not be confirmed. Check before retrying.");
  }
  return NextResponse.json(await result.json(),{
   headers:{"Cache-Control":"no-store","Referrer-Policy":"no-referrer"}});
 }catch{return fail(503,"The private photo outcome is uncertain. Check original status.");}
}
export async function GET(req:NextRequest,ctx:Ctx){return handler(req,ctx,"GET");}
export async function POST(req:NextRequest,ctx:Ctx){return handler(req,ctx,"POST");}
