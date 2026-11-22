import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts?:string[]}>};
async function proxy(req:NextRequest,ctx:Ctx,method:"GET"|"POST"|"PATCH"){
 const parts=(await ctx.params).parts??[],id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const valid=(!parts.length&&(method==="GET"||method==="POST"))||(parts.length===1&&(method==="GET"&&parts[0]==="export"||method==="PATCH"&&id.test(parts[0])));
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 if(!valid)return reply({message:"Membership plan action unavailable."},404);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed."},403);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);
 if(!base)return reply({message:"Membership plans unavailable."},503);
 try{
  const url=new URL("/api/v1/membership/tiers"+(parts.length?"/"+parts[0]:""),base);
  for(const k of ["q","category","status","cursor"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  const body=method==="GET"?undefined:await req.text();
  if(body&&body.length>24000)return reply({message:"Check membership plan fields."},400);
  const r=await fetch(url,{method,body,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(12000)});
  const v=await r.json().catch(()=>null);
  if(r.ok&&v!==null)return reply(v,r.status);
  if([400,409].includes(r.status)&&["CG04_TIER_INVALID","CG04_TIER_CONFLICT","CG04_TIER_DUPLICATE"].includes(v?.code)&&typeof v.message==="string")
   return reply({code:v.code,message:v.message,field:typeof v.field==="string"?v.field:undefined},r.status);
  return reply({message:r.status===401?"Sign in again.":r.status===403?"Your current role cannot manage membership plans.":r.status===404?"Membership plan unavailable.":r.status===409?"This plan changed. Refresh and review.":r.status===400?"Check membership plan fields.":"The result could not be confirmed. Retry the same request."},r.ok?503:r.status);
 }catch{return reply({message:"The result could not be confirmed. Retry the same request."},503);}
}
export const GET=(r:NextRequest,c:Ctx)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Ctx)=>proxy(r,c,"POST");
export const PATCH=(r:NextRequest,c:Ctx)=>proxy(r,c,"PATCH");
