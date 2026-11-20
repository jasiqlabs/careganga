import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const fail=(status:number,message:string)=>NextResponse.json({message},{status,
 headers:{"Cache-Control":"no-store"}});
async function proxy(req:NextRequest,ctx:Ctx,method:"GET"|"POST"){
 const parts=(await ctx.params).parts;
 const valid=method==="GET"?
  (parts.length===1&&parts[0]==="list")||
  (parts.length===1&&UUID.test(parts[0])):
  parts.length===2&&UUID.test(parts[0])&&parts[1]==="decide";
 if(!valid)return fail(404,"This review action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return fail(403,"Submit your decision from CareGanga.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return fail(401,"Sign in to review doctor leave.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return fail(503,"Doctor leave review is temporarily unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const data:unknown=await req.json();
   if(!data||typeof data!=="object"||Array.isArray(data))throw Error();
   body=JSON.stringify(data);
   if(body.length>2400)throw Error();
  }catch{return fail(400,"Check the decision and password before submitting.");}
 }
 const path=parts[0]==="list"?"":parts.join("/");
 try{
  const result=await fetch(new URL("/api/health/doctor-leave-reviews/"+path,backend),{
   method,body,cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,
    ...(body?{"Content-Type":"application/json"}:{})}
  });
  if(!result.ok){
   const status=[400,401,403,404,409,429].includes(result.status)?result.status:503;
   const body:unknown=await result.json().catch(()=>null);
   const supported=new Set(["CG15_LEAVE_INVALID",
    "CG15_LEAVE_SOURCE_CHANGED","CG15_LEAVE_DECISION_INVALID"]);
   if(status<500&&body&&typeof body==="object"&&"code" in body&&
     typeof body.code==="string"&&supported.has(body.code)&&
     "message" in body&&typeof body.message==="string"&&
     body.message.length>=16&&body.message.length<=240&&
     !/[<>\u0000-\u001f\u007f]/.test(body.message))
    return NextResponse.json({code:body.code,message:body.message},{
     status,headers:{"Cache-Control":"no-store"}});
   return fail(status,status===401?"Your session expired. Sign in again.":
    status===403?"Only an authorized independent Foundation reviewer may act.":
    status===409?"This doctor leave review changed. Refresh before retrying.":
    status===404?"This review record is unavailable.":
    status===400?"Check the decision details and current password.":
    "The review could not be confirmed. Recheck its original status.");
  }
  return NextResponse.json(await result.json(),{headers:{"Cache-Control":"no-store"}});
 }catch{return fail(503,"The review outcome is unconfirmed. Recheck the original decision.");}
}
export async function GET(req:NextRequest,ctx:Ctx){return proxy(req,ctx,"GET");}
export async function POST(req:NextRequest,ctx:Ctx){return proxy(req,ctx,"POST");}
