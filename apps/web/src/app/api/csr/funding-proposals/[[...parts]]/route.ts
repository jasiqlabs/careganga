import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const parts=(await ctx.params).parts??[];
 const allowed=(parts.length===0&&(method==="GET"||method==="POST"))||
  (parts.length===1&&(method==="GET"&&(parts[0]==="options"||UUID.test(parts[0]))||
   method==="PATCH"&&UUID.test(parts[0])))||
  (parts.length===2&&UUID.test(parts[0])&&(
   method==="POST"&&["submit","resume"].includes(parts[1])||
   method==="GET"&&["review-history","finance"].includes(parts[1])))||
  (parts.length===3&&UUID.test(parts[0])&&parts[1]==="finance"&&(
   method==="GET"&&parts[2]==="eligible-receipts"||
   method==="POST"&&parts[2]==="receipts"));
 if(!allowed)return reply({message:"The original CSR funding action is unavailable."},404);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"Save funding through the authenticated Foundation panel."},403);
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return reply({message:"Sign in to manage Foundation funding."},401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply({message:"CSR funding service is unavailable."},503);
 let body:string|undefined;
 if(method!=="GET"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return reply({message:"Use the original funding form."},415);
  try{
   body=await req.text();
   if(body.length>12000)throw Error();
   const parsed:unknown=JSON.parse(body);
   if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error();
  }catch{return reply({message:"Check the funding source, amount, split and purpose."},400);}
 }
 try{
  const url=new URL("/api/v1/csr/funding-proposals"+
   (parts.length?"/"+parts.join("/"):""),backend);
  if(method==="GET"&&parts.length===0)
   for(const key of ["q","status","branchRef","offset"])
    if(req.nextUrl.searchParams.has(key))
     url.searchParams.set(key,req.nextUrl.searchParams.get(key)!);
  const res=await fetch(url,{method,body,cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+session,...(body?{"Content-Type":"application/json"}:{})}});
  const result:unknown=await res.json().catch(()=>null);
  if(res.ok&&result!==null)return reply(result,res.status);
  const status=[400,401,403,404,409,429].includes(res.status)?res.status:503;
  return reply({message:status===401?"Sign in again.":status===403?
   "Your current role or branch cannot access this original funding record.":
   status===404?"Funding proposal unavailable in your permitted branch.":
   status===409?"The funding source, sponsor or project changed. Refresh before editing.":
   status===400?"Check the proposed amount, category, approved sponsor and exact 100% split.":
   "Funding outcome is uncertain. Check the current draft before retrying."},status);
 }catch{return reply({message:"Funding outcome is uncertain. Check the current draft before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"PATCH");
