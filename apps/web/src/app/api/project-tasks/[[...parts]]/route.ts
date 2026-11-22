import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const p=(await ctx.params).parts??[],id=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed."},403);
 let target:string|null=null;
 if(!p.length&&method==="GET")target="/api/v1/project-tasks";
 else if(p.length===1&&method==="GET"&&p[0]==="me")target="/api/v1/field/me/tasks";
 else if(p.length===1&&method==="GET"&&(["options","export"].includes(p[0])||id(p[0])))target="/api/v1/project-tasks/"+p[0];
 else if(p.length===1&&method==="PATCH"&&id(p[0]))target="/api/v1/project-tasks/"+p[0];
 else if(p.length===2&&p[0]==="project"&&id(p[1])&&method==="POST")target="/api/v1/projects/"+p[1]+"/tasks";
 else if(p.length===2&&id(p[0])&&["assign","progress"].includes(p[1])&&method==="POST")target="/api/v1/project-tasks/"+p.join("/");
 if(!target)return reply({message:"Task action unavailable."},404);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);if(!base)return reply({message:"Tasks unavailable."},503);
 try{
  const url=new URL(target,base);
  for(const k of ["projectRef","q","taskType","priority","status","assignee","location","tab","from","to","startFrom","startTo","offset"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  let body:string|undefined;if(method!=="GET"){body=await req.text();if(body.length>16384)return reply({message:"Check task fields."},400);}
  const r=await fetch(url,{method,body,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000)});
  const v=await r.json().catch(()=>null);if(r.ok&&v!==null)return reply(v,r.status);
  return reply({message:r.status===401?"Sign in again.":r.status===403?"Your current task or branch permission does not allow this action.":r.status===404?"Task unavailable.":r.status===409?"The task changed. Refresh and check its current assignment.":r.status===400?"Check task details and project dates.":"Task result could not be confirmed."},r.ok?503:r.status);
 }catch{return reply({message:"Task result could not be confirmed."},503);}
}
export const GET=(r:NextRequest,c:Context)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Context)=>proxy(r,c,"POST");
export const PATCH=(r:NextRequest,c:Context)=>proxy(r,c,"PATCH");
