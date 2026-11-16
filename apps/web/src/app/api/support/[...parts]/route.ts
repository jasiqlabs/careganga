import {cookies} from "next/headers";
import {createHmac} from "node:crypto";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
type Method="GET"|"POST"|"PATCH";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function permitted(parts:string[],method:Method){
  if(parts.join("/")==="public/contact"&&method==="POST")return "PUBLIC";
  if(parts.join("/")==="receipt/status"&&method==="POST")return "PUBLIC";
  if(parts.join("/")==="public/faqs"&&method==="GET")return "PUBLIC";
  if(parts.length===1&&parts[0]==="cases"&&method==="GET")return "STAFF";
  if(parts.length===2&&parts[0]==="cases"&&parts[1]==="search"&&
    method==="POST")return "STAFF";
  if(parts.length===1&&parts[0]==="faqs"&&["GET","POST"].includes(method))
    return "STAFF";
  if(parts.length===2&&parts[0]==="cases"&&UUID.test(parts[1])&&method==="GET")
    return "STAFF";
  if(parts.length===2&&parts[0]==="faqs"&&UUID.test(parts[1])&&method==="PATCH")
    return "STAFF";
  if(parts.length===3&&parts[0]==="cases"&&UUID.test(parts[1])&&
    ["read","archive","assign","reply"].includes(parts[2])&&method==="POST")
    return "STAFF";
  if(parts.length===3&&parts[0]==="cases"&&UUID.test(parts[1])&&
    parts[2]==="status"&&method==="PATCH")return "STAFF";
  return null;
}
function fail(status:number,message:string){
  return NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});
}
async function handler(request:NextRequest,ctx:Ctx,method:Method){
  const parts=(await ctx.params).parts;
  const access=permitted(parts,method);
  if(!access)return fail(404,"Requested action unavailable.");
  if(method!=="GET"&&request.headers.get("origin")!==request.nextUrl.origin)
    return fail(403,"Submit from the original CareGanga page.");
  const token=access==="STAFF"?(await cookies()).get("cg_staff_session")?.value:undefined;
  if(access==="STAFF"&&!token)return fail(401,"Sign in to Foundation support.");
  const backend=process.env.BACKEND_URL;
  if(!backend)return fail(503,"Foundation support is unavailable.");
  let body:string|undefined;
  if(method!=="GET"){
    const length=Number(request.headers.get("content-length")??0);
    if(!Number.isFinite(length)||length>6000)
      return fail(413,"The request is too large.");
    try{
      const payload:unknown=await request.json();
      if(!payload||typeof payload!=="object"||Array.isArray(payload))throw Error();
      body=JSON.stringify(payload);
      if(body.length>6000)throw Error();
    }catch{return fail(400,"Check the supplied information.");}
  }
  let proxyHeaders:Record<string,string>={};
  if(access==="PUBLIC"&&method==="POST"&&
    (parts.join("/")==="public/contact"||parts.join("/")==="receipt/status")){
    const secret=Buffer.from(process.env.CG19_GUEST_PROXY_KEY??"","base64");
    const trustedHeader=process.env.CG19_TRUSTED_CLIENT_IP_HEADER;
    if(secret.length>0){
      if(secret.length!==32||!trustedHeader||!/^[a-z0-9-]{2,60}$/.test(trustedHeader))
        return fail(503,"Trusted support ingress is not configured.");
      // Deployment ingress MUST overwrite/remove incoming trustedHeader and
      // populate it from a real client socket. Never blindly trust XFF.
      const client=request.headers.get(trustedHeader);
      if(!client||!/^[0-9a-fA-F:.]{3,45}$/.test(client))
        return fail(503,"Trusted client address is unavailable.");
      const timestamp=String(Date.now());
      const route=parts.join("/")==="public/contact"?"contact":"status";
      const proof=createHmac("sha256",secret)
        .update(route+":"+timestamp+":"+client).digest("hex");
      proxyHeaders={"x-cg19-proxy-client":client,
        "x-cg19-proxy-ts":timestamp,"x-cg19-proxy-proof":proof};
    }
  }
  try{
    const url=new URL("/api/support/"+parts.join("/"),backend);
    if(method==="GET"&&access==="STAFF")url.search=request.nextUrl.search;
    const result=await fetch(url,{method,body,cache:"no-store",
      signal:AbortSignal.timeout(12000),
      headers:{...proxyHeaders,...(token?{Authorization:"Bearer "+token}:{}),
        ...(body?{"Content-Type":"application/json"}:{})}
    });
    if(!result.ok){
      const status=[400,401,403,404,409,413,429].includes(result.status)?
        result.status:503;
      return fail(status,status===409?"Original record changed. Refresh before retrying.":
        status===401?"Sign in again.":
        status===403?"Current role cannot perform this action.":
        status===404?"Original record or receipt unavailable.":
        status===429?"Too many requests. Try again later.":
        status===400?"Check the entered information.":
        "Outcome unconfirmed. Check the original status before retrying.");
    }
    const data:unknown=await result.json();
    return NextResponse.json(data,{headers:{"Cache-Control":"no-store",
      "Referrer-Policy":"no-referrer"}});
  }catch{
    return fail(503,"The action could not be confirmed. Check original status before retrying.");
  }
}
export async function GET(request:NextRequest,ctx:Ctx){return handler(request,ctx,"GET")}
export async function POST(request:NextRequest,ctx:Ctx){return handler(request,ctx,"POST")}
export async function PATCH(request:NextRequest,ctx:Ctx){return handler(request,ctx,"PATCH")}
