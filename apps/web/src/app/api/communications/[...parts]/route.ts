import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function permitted(parts:string[],method:"GET"|"POST"){
  if(parts.length===1){
    if(["inbox","notices","preferences"].includes(parts[0]))
      return method==="GET"||method==="POST"&&parts[0]!=="inbox";
    return method==="POST"&&["recover-decisions","process-due"].includes(parts[0]);
  }
  if(parts.length===2&&parts[0]==="providers"&&parts[1]==="status")
    return method==="GET";
  if(parts.length===3&&parts[0]==="inbox"&&UUID.test(parts[1])&&
    parts[2]==="read")return method==="POST";
  if(parts.length===3&&parts[0]==="notices"&&parts[1]==="requests"&&
    UUID.test(parts[2]))return method==="GET";
  if(parts.length===3&&parts[0]==="notices"&&UUID.test(parts[1])&&
    parts[2]==="decision")return method==="POST";
  if(parts.length===3&&parts[0]==="notices"&&UUID.test(parts[1])&&
    parts[2]==="counts")return method==="GET";
  return false;
}
const error=(status:number,message:string)=>NextResponse.json({message},
  {status,headers:{"Cache-Control":"no-store"}});
async function proxy(request:NextRequest,parts:string[],method:"GET"|"POST"){
  if(!permitted(parts,method))return error(404,"This action is not available.");
  if(method==="POST"&&request.headers.get("origin")!==request.nextUrl.origin)
    return error(403,"Please submit this request from CareGanga.");
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return error(401,"Sign in to access Foundation notices.");
  const backend=process.env.BACKEND_URL;
  if(!backend)return error(503,"Notice service is unavailable.");
  let body:string|undefined;
  if(method==="POST"&&
    (parts[0]==="notices"&&parts.length===1||
      parts[0]==="notices"&&parts.length===3&&parts[2]==="decision"||
      parts[0]==="preferences")){
    try{
      const parsed:unknown=await request.json();
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error();
      body=JSON.stringify(parsed);
      if(body.length>3200)throw Error();
    }catch{return error(400,"Check the notice or preference details.");}
  }
  try{
    const url=new URL("/api/communications/"+parts.join("/"),backend);
    if(method==="GET")url.search=request.nextUrl.search;
    const response=await fetch(url,{
      method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
      headers:{Authorization:"Bearer "+token,
        ...(body?{"Content-Type":"application/json"}:{})}
    });
    if(!response.ok){
      const status=[400,401,403,404,409,429].includes(response.status)?
        response.status:503;
      return error(status,status===401?"Sign in again.":
        status===403?"Your role does not permit this action.":
        status===404?"The requested notice is unavailable.":
        status===409?"The original notice changed. Refresh before retrying.":
        status===429?"Too many requests.":
        status===400?"Check your notice details.":
        "Result unconfirmed. Check original status before retrying.");
    }
    const data:unknown=await response.json();
    return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
  }catch{return error(503,"The action outcome could not be confirmed. Refresh before retrying.");}
}
export async function GET(request:NextRequest,ctx:Ctx){
  return proxy(request,(await ctx.params).parts,"GET");
}
export async function POST(request:NextRequest,ctx:Ctx){
  return proxy(request,(await ctx.params).parts,"POST");
}
