import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const p=(await ctx.params).parts??[],id=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed."},403);
 let target:string|null=null;
 if(!p.length&&(method==="GET"||method==="POST"))target="/api/v1/activities";
 else if(p.length===1&&method==="GET"&&p[0]==="me")target="/api/v1/field/me/activities";
 else if(p.length===2&&method==="GET"&&p[0]==="me"&&p[1]==="export")target="/api/v1/field/me/activities/export";
 else if(p.length===1&&method==="GET"&&(["options","export","geography"].includes(p[0])||id(p[0])))target="/api/v1/activities/"+p[0];
 else if(p.length===1&&method==="PATCH"&&id(p[0]))target="/api/v1/activities/"+p[0];
 else if(p.length===2&&id(p[0])&&p[1]==="status"&&method==="POST")target="/api/v1/activities/"+p.join("/");
 if(!target)return reply({message:"Activity action unavailable."},404);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);if(!base)return reply({message:"Activities unavailable."},503);
 try{
  const url=new URL(target,base);
  for(const k of ["projectRef","q","kind","activityType","category","status","stateRef","districtRef","branchRef","owner","location","tab","from","to","offset"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  let body:string|undefined;if(method!=="GET"){body=await req.text();if(body.length>16384)return reply({message:"Check activity fields."},400);}
  const r=await fetch(url,{method,body,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000)});
  const v=await r.json().catch(()=>null);if(r.ok&&v!==null)return reply(v,r.status);
  return reply({message:r.status===401?"Sign in again.":r.status===403?"Your current activity or branch permission does not allow this action.":r.status===404?"Activity unavailable.":r.status===409?"The activity changed. Refresh and review the current record.":r.status===400?"Check activity details and project dates.":"Activity result could not be confirmed."},r.ok?503:r.status);
 }catch{return reply({message:"Activity result could not be confirmed."},503);}
}
export const GET=(r:NextRequest,c:Context)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Context)=>proxy(r,c,"POST");
export const PATCH=(r:NextRequest,c:Context)=>proxy(r,c,"PATCH");
