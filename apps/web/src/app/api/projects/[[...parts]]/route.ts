import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const p=(await ctx.params).parts??[],ref=(s:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s);
 const valid=p.length===0&&["GET","POST"].includes(method)||p.length===1&&(method==="GET"&&(["me","options","geography","export"].includes(p[0])||ref(p[0]))||method==="PATCH"&&ref(p[0]))||p.length===2&&ref(p[0])&&["change-status","branch-change"].includes(p[1])&&method==="POST";
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed."},403);
 if(!valid)return reply({message:"Project action unavailable."},404);
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)return reply({message:"Sign in again."},401);
 const base=process.env.BACKEND_URL;if(!base)return reply({message:"Projects unavailable."},503);
 try{
  const url=new URL("/api/v1/projects"+(p.length?"/"+p.join("/"):""),base);
  for(const k of ["q","category","status","priority","fundingSource","stateRef","districtRef","from","to","offset","branchRef","ownerRef"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  let body:string|undefined;if(method!=="GET"){body=await req.text();if(body.length>32768)return reply({message:"Check project fields."},400);}
  const r=await fetch(url,{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(12000)});
  const v=await r.json().catch(()=>null);if(r.ok&&v!==null)return reply(v,r.status);
  return reply({message:r.status===401?"Sign in again.":r.status===403?"Your current role or branch does not permit this action.":r.status===409?"The project changed or the code already exists. Refresh and check.":r.status===400?"Check the project fields.":r.status===404?"Project unavailable.":"Could not confirm the result. Retry the same request."},r.ok?503:r.status);
 }catch{return reply({message:"Could not confirm the result. Retry the same request."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"PATCH");
