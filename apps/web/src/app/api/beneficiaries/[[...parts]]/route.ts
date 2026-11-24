import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
type Method="GET"|"POST"|"PATCH"|"DELETE";
const uuid=(v:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
function allowed(parts:string[],method:Method){
 if(parts.length===0)return method==="GET"||method==="POST";
 if(parts.length===1)return method==="GET"&&["options","eligible-projects","duplicate-suggestions"].includes(parts[0])
   ||uuid(parts[0])&&(method==="GET"||method==="PATCH");
 if(parts.length===3&&parts[0]==="verification-cases"&&uuid(parts[1])&&parts[2]==="decide")return method==="POST";
 if(parts.length===2&&uuid(parts[0])){
  if(["history","verification-history","verification-review"].includes(parts[1]))return method==="GET";
  if(parts[1]==="submit-verification")return method==="POST";
  if(parts[1]==="project-links")return method==="POST"||method==="DELETE";
  if(parts[1]==="lifecycle")return method==="PATCH";
  if(parts[1]==="revoke-consent")return method==="POST";
 }
 return false;
}
async function proxy(req:NextRequest,ctx:Context,method:Method){
 const p=(await ctx.params).parts??[];
 if(!allowed(p,method))return reply({message:"Beneficiary action unavailable"},404);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"Request origin not allowed"},403);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply({message:"Sign in again"},401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply({message:"Beneficiary service unavailable"},503);
 try{
  const url=new URL("/api/v1/beneficiaries"+(p.length?"/"+p.join("/"):""),backend);
  for(const k of ["q","branchRef","stateRef","districtRef","projectRef","verification","lifecycle","type","cursor","name","contactMobile","excludeRef"]){
   const v=req.nextUrl.searchParams.get(k);if(v!==null&&v.length<=240)url.searchParams.set(k,v);
  }
  let body:string|undefined;
  if(method!=="GET"){
   body=await req.text();
   if(body.length>16384)return reply({message:"Check beneficiary fields"},400);
  }
  const res=await fetch(url,{method,cache:"no-store",
   headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
   body,signal:AbortSignal.timeout(12000)});
  const json=await res.json().catch(()=>null);
  if(res.ok&&json!==null)return reply(json,res.status);
  const message=res.status===401?"Sign in again":
   res.status===403?"Your current role or branch does not allow this action":
   res.status===404?"Beneficiary unavailable":
   res.status===409?"The beneficiary or project link changed. Refresh and review":
   res.status===400?"Check the beneficiary information":
   "Could not confirm the outcome. Check the list before retrying";
  return reply({message},res.ok?503:res.status);
 }catch{return reply({message:"Could not confirm the outcome. Check the list before retrying"},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"PATCH");
export const DELETE=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"DELETE");
