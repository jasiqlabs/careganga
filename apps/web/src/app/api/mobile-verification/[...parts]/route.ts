import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Params={params:Promise<{parts:string[]}>};
const err=(status:number,message:string)=>NextResponse.json({message},
  {status,headers:{"Cache-Control":"no-store"}});
async function route(request:NextRequest,ctx:Params,method:"GET"|"POST"){
  const parts=(await ctx.params).parts;
  const allowed=method==="GET"&&parts.length===1&&parts[0]==="status"||
    method==="POST"&&parts.length===2&&parts[0]==="verify"&&
      ["start","confirm"].includes(parts[1]);
  if(!allowed)return err(404,"Mobile verification action unavailable.");
  if(method==="POST"&&request.headers.get("origin")!==request.nextUrl.origin)
    return err(403,"Submit this action from CareGanga.");
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return err(401,"Sign in to verify your contact.");
  const backend=process.env.BACKEND_URL;
  if(!backend)return err(503,"Verification is unavailable.");
  let body:string|undefined;
  if(method==="POST"&&parts[1]==="confirm"){
    try{
      const json:unknown=await request.json();
      if(!json||typeof json!=="object"||Array.isArray(json)||
        !("code" in json)||typeof json.code!=="string"||
        !/^\d{4,10}$/.test(json.code)||Object.keys(json).length!==1)
        throw Error();
      body=JSON.stringify(json);
    }catch{return err(400,"Check the one-time code.");}
  }
  try{
    const response=await fetch(
      new URL("/api/identity/mobile/"+parts.join("/"),backend),{
        method,body,cache:"no-store",signal:AbortSignal.timeout(14000),
        headers:{Authorization:"Bearer "+token,
          ...(body?{"Content-Type":"application/json"}:{})}
      });
    if(!response.ok){
      const status=[400,401,403,409,429].includes(response.status)?
        response.status:503;
      return err(status,status===401?"Session expired. Sign in again.":
        status===429?"Too many verification attempts.":
        "Mobile proof could not be confirmed. Check original status.");
    }
    const data:unknown=await response.json();
    return NextResponse.json(data,{headers:{"Cache-Control":"no-store"}});
  }catch{return err(503,"The original verification result is uncertain.");}
}
export async function GET(request:NextRequest,ctx:Params){return route(request,ctx,"GET");}
export async function POST(request:NextRequest,ctx:Params){return route(request,ctx,"POST");}
