import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(status:number,message:string,code?:string)=>NextResponse.json(
  {message,...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}}
);
function allow(parts:string[],method:"GET"|"POST"):boolean{
  if(parts.length===1){
    return parts[0]==="process"&&method==="GET"||
      parts[0]==="cases"&&(method==="GET"||method==="POST");
  }
  if(parts.length===2){
    if(parts[0]==="process"&&parts[1]==="versions")return method==="POST";
    if(parts[0]==="options"&&["account","role"].includes(parts[1]))return method==="GET";
    if(parts[0]==="cases"&&UUID.test(parts[1]))return method==="GET";
  }
  if(parts.length===3&&parts[0]==="cases"&&UUID.test(parts[1])&&
     parts[2]==="decisions")return method==="POST";
  if(parts.length===5&&parts[0]==="cases"&&UUID.test(parts[1])&&
     parts[2]==="decisions"&&parts[3]==="requests"&&UUID.test(parts[4]))
     return method==="GET";
  if(parts.length===3&&parts[0]==="process"&&parts[1]==="changes"&&UUID.test(parts[2]))
    return method==="GET";
  if(parts.length===3&&parts[0]==="cases"&&parts[1]==="requests"&&UUID.test(parts[2]))
    return method==="GET";
  return false;
}
async function proxy(req:NextRequest,parts:string[],method:"GET"|"POST"){
  if(!allow(parts,method))return reply(404,"This approval action is unavailable.");
  if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
    return reply(403,"Please submit this request from CareGanga.");
  const session=(await cookies()).get("cg_staff_session")?.value;
  if(!session)return reply(401,"Sign in to continue.");
  if(!process.env.BACKEND_URL)return reply(503,"Foundation approvals are unavailable.");
  let body:string|undefined;
  if(method==="POST"){
    try{
      const input:unknown=await req.json();
      if(!input||typeof input!=="object"||Array.isArray(input))throw Error();
      body=JSON.stringify(input);
      if(body.length>2500)throw Error();
    }catch{return reply(400,"Check the application details.");}
  }
  try{
    const url=new URL("/api/registration-approvals/"+parts.join("/"),process.env.BACKEND_URL);
    if(method==="GET")url.search=req.nextUrl.search;
    const response=await fetch(url,{
      method,cache:"no-store",signal:AbortSignal.timeout(12000),body,
      headers:{Authorization:"Bearer "+session,...(body?{"Content-Type":"application/json"}:{})}
    });
    if(!response.ok){
      const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
      let code:string|undefined;
      if(status===409){
        try{
          const err:unknown=await response.json();
          if(err&&typeof err==="object"&&"code" in err&&typeof err.code==="string"&&
            ["REVIEWER_REQUIRED","APPROVAL_REPLAY_CONFLICT","ACTIVE_CASE_EXISTS",
              "CORRECTION_REQUIRES_RETURN"].includes(err.code))code=err.code;
        }catch{}
      }
      return reply(status,status===401?"Your session expired. Sign in again.":
        status===403?"You cannot access this protected application.":
        status===409?"The application or reviewer route changed. Refresh before continuing.":
        status===400?"Check the account, role and request details.":
        status===429?"Too many security attempts. Try again later.":
        status===404?"This application is unavailable.":
        "The result could not be confirmed. Check the original request before retrying.",code);
    }
    const result:unknown=await response.json();
    return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch{
    return reply(503,"The request result is uncertain. Check its original status.");
  }
}
export async function GET(req:NextRequest,context:Context){
  return proxy(req,(await context.params).parts,"GET");
}
export async function POST(req:NextRequest,context:Context){
  return proxy(req,(await context.params).parts,"POST");
}
