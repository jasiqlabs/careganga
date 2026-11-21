import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const result=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(req:NextRequest,ctx:Ctx){
 const {parts}=await ctx.params;
 if(parts.length!==3||!["foundation","partner"].includes(parts[0])||
   parts[1]!=="centers"||!UUID.test(parts[2])||
   [...req.nextUrl.searchParams.keys()].length>0)
  return result(404,"This partner claim list is unavailable.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return result(401,"Sign in to view authorized partner records.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return result(503,"Partner claim records are temporarily unavailable.");
 try{
  const path="/api/v1/healthcare-assistance/partner-claims/"+
   parts.map(encodeURIComponent).join("/");
  const upstream=await fetch(new URL(path,backend),{cache:"no-store",
   signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token}});
  if(!upstream.ok){
   const status=[400,401,403,404,409,429].includes(upstream.status)?
    upstream.status:503;
   return result(status,status===401?"Your staff session expired. Sign in again.":
    status===403?"Your role cannot view these partner claims.":
    status===404?"This verified center is not available to your account.":
    status===409?"The original claim list changed. Refresh the source.":
    "The current partner claim list could not be confirmed.");
  }
  const body:unknown=await upstream.json();
  const object=body&&typeof body==="object"&&!Array.isArray(body)?
   body as Record<string,unknown>:null;
  if(!object||!Array.isArray(object.claims)||
    !object.claims.every(v=>v&&typeof v==="object"&&
      typeof v.claimCode==="string"&&
      typeof v.state==="string"&&v.state==="PENDING_VERIFICATION"))
   return result(503,"Current partner claims could not be verified.");
  return NextResponse.json(body,{headers:{"Cache-Control":"private, no-store"}});
 }catch{return result(503,"The current claim list could not be confirmed. Retry.");}
}
