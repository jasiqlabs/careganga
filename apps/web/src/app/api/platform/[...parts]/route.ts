import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LABEL=/^[a-z][a-z0-9_-]{1,62}$/;
const reply=(message:string,status:number,code?:string)=>NextResponse.json(
  {message,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}}
);
function permitted(parts:string[],method:string):boolean{
  if(parts.length===1){
    if(parts[0]==="settings")return method==="GET"||method==="PATCH";
    if(parts[0]==="integrations")return method==="GET"||method==="POST";
    if(parts[0]==="audit")return method==="GET";
    if(parts[0]==="error-messages")return method==="GET"||method==="PATCH";
  }
  if(parts.length===2&&parts[0]==="settings"&&parts[1]==="history")return method==="GET";
  if(parts.length===2&&parts[0]==="audit"&&parts[1]==="export")return method==="GET";
  if(parts.length===2&&parts[0]==="recovery"){
    if(parts[1]==="availability"||parts[1]==="operations")return method==="GET";
    if(parts[1]==="request")return method==="POST";
  }
  if(parts.length===3&&parts[0]==="audit"&&parts[1]==="detail"&&
    /^[A-Za-z0-9_-]{35,1300}$/.test(parts[2]))return method==="GET";
  if(parts.length===3&&parts[0]==="recovery"&&parts[1]==="changes"&&
    UUID.test(parts[2]))return method==="GET";
  if(parts.length===4&&parts[0]==="recovery"&&parts[1]==="operations"&&
    UUID.test(parts[2])&&parts[3]==="authorize")return method==="POST";
  if(parts.length===4&&parts[0]==="recovery"&&parts[1]==="authorization"&&
    parts[2]==="changes"&&UUID.test(parts[3]))return method==="GET";
  if(parts.length===3&&parts[0]==="changes"&&
    ["SETTING_SAVE","INTEGRATION_REFERENCE"].includes(parts[1])&&UUID.test(parts[2]))
    return method==="GET";
  return parts.length===4&&parts[0]==="integrations"&&
    LABEL.test(parts[1])&&LABEL.test(parts[2])&&parts[3]==="check"&&method==="POST";
}
async function proxy(req:NextRequest,parts:string[],method:"GET"|"POST"|"PATCH"){
  if(!permitted(parts,method))return reply("This action is not available.",404);
  if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
    return reply("Please retry from CareGanga.",403);
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return reply("Sign in to view platform settings.",401);
  const backend=process.env.BACKEND_URL;
  if(!backend)return reply("Platform settings are temporarily unavailable.",503);
  let body:string|undefined;
  if(method!=="GET"){
    if(parts.length===1||(parts.length===2&&parts[0]==="recovery"&&parts[1]==="request")||
      (parts.length===4&&parts[0]==="recovery"&&parts[1]==="operations"&&
        parts[3]==="authorize")){
      try{
        const input:unknown=await req.json();
        if(!input||typeof input!=="object"||Array.isArray(input))throw Error();
        body=JSON.stringify(input);
        if(body.length>3500)throw Error();
      }catch{return reply("Check the entered settings.",400);}
    }
  }
  try{
    const url=new URL("/api/platform-configuration-audit/"+parts.join("/"),backend);
    if(method==="GET")url.search=req.nextUrl.search;
    const response=await fetch(url,{
      method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      body,cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    if(!response.ok){
      const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
      // CG-21 editor: return only backend-allowlisted plain-language outcomes.
      // Never proxy an arbitrary provider, database or exception message.
      if(parts.length===1&&parts[0]==="error-messages"&&status<500){
        const safeKeys=new Set(["PLATFORM_COPY_FORM_INVALID","PLATFORM_COPY_UNSUPPORTED",
         "PLATFORM_COPY_WORDING_INVALID","PLATFORM_COPY_STALE",
         "PLATFORM_COPY_PASSWORD_REQUIRED","PLATFORM_COPY_NO_CHANGE",
         "PLATFORM_COPY_REPLAY_CONFLICT","PLATFORM_STALE"]);
        const responseBody:unknown=await response.json().catch(()=>null);
        if(responseBody&&typeof responseBody==="object"&&!Array.isArray(responseBody)&&
          "code" in responseBody&&typeof responseBody.code==="string"&&
          safeKeys.has(responseBody.code)&&"message" in responseBody&&
          typeof responseBody.message==="string"&&responseBody.message.length<=220){
          return reply(responseBody.message,status,responseBody.code);
        }
      }
      let code:string|undefined;
      if(status===409){
        try{
          const info:unknown=await response.json();
          if(info&&typeof info==="object"&&"code" in info&&
            (info.code==="PLATFORM_STALE"||info.code==="PLATFORM_REPLAY_CONFLICT"))
            code=info.code;
        }catch{/* Never echo unreviewed backend diagnostics. */}
      }
      return reply(status===401?"Your session expired. Sign in again.":
        status===403?"Only an authorized Foundation administrator can access this setting.":
        status===409?"The setting changed elsewhere. Refresh before saving.":
        status===429?"Too many security checks. Try again later.":
        status===400?"Check the allowed values and confirm with your current password.":
        status===404?"This configuration is not available.":
        "The result could not be confirmed. Check before retrying.",status,code);
    }
    const result:unknown=await response.json();
    return NextResponse.json(result,{status:response.status,headers:{"Cache-Control":"no-store"}});
  }catch{return reply("The result is unconfirmed. Check status before trying again.",503);}
}
export async function GET(req:NextRequest,ctx:Context){return proxy(req,(await ctx.params).parts,"GET");}
export async function POST(req:NextRequest,ctx:Context){return proxy(req,(await ctx.params).parts,"POST");}
export async function PATCH(req:NextRequest,ctx:Context){return proxy(req,(await ctx.params).parts,"PATCH");}
