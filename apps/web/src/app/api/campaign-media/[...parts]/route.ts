import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"){
 const p=(await ctx.params).parts,ref=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
 const valid=method==="GET"&&p.length===2&&["campaigns","intents","files"].includes(p[0])&&ref(p[1])||method==="POST"&&(p.length===1&&p[0]==="intents"||p.length===3&&p[0]==="intents"&&ref(p[1])&&p[2]==="confirm");
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed."},403);
 if(!valid)return reply({message:"Campaign media action unavailable."},404);
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)return reply({message:"Sign in again."},401);
 const base=process.env.BACKEND_URL;if(!base)return reply({message:"Campaign private storage unavailable."},503);
 try{
  let body:string|undefined;if(method==="POST"){body=await req.text();if(body.length>4096)return reply({message:"Check campaign media details."},400);}
  const response=await fetch(new URL("/api/v1/campaign-media/"+p.join("/"),base),{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(45000)});
  if(response.ok&&p[0]==="files"){
   const type=response.headers.get("content-type")?.split(";")[0];
   if(!type||!["image/png","image/jpeg","image/webp","application/pdf"].includes(type))return reply({message:"Verified private campaign file unavailable."},503);
   const bytes=await response.arrayBuffer();if(!bytes.byteLength||bytes.byteLength>10485760)return reply({message:"Verified private campaign file unavailable."},503);
   return new NextResponse(bytes,{headers:{"Content-Type":type,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Disposition":"inline"}});
  }
  const v=await response.json().catch(()=>null);if(response.ok&&v!==null)return reply(v,response.status);
  return reply({message:response.status===401?"Sign in again.":response.status===403?"Your current campaign or current role does not permit this action.":response.status===409?"Campaign media changed; refresh its current draft.":response.status===400?"Choose an allowed campaign image or PDF.":"Private campaign file status could not be verified."},response.ok?503:response.status);
 }catch{return reply({message:"Private campaign file status could not be verified."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
