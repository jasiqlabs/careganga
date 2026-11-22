import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts?:string[]}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function request(req:NextRequest,ctx:Ctx,method:"GET"|"POST"){
 const parts=(await ctx.params).parts??[],route=parts.join("/");
 const reimbursement=parts.length===2&&UUID.test(parts[0])&&parts[1]==="reimbursement-options";
 const roster=parts.length===0,exporting=route==="export",intakeList=route==="intake/drafts";
 const preview=route==="intake/preview",intake=route==="intake";
 if(!(method==="GET"?(reimbursement||roster||exporting||intakeList):(preview||intake)))
  return reply({message:"Volunteer action unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"Submit intake through the Foundation staff panel."},403);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply({message:"Sign in again."},401);
 const base=process.env.BACKEND_URL;
 if(!base)return reply({message:"Volunteer administration temporarily unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  if(!req.headers.get("content-type")?.includes("application/json")||
     Number(req.headers.get("content-length")??0)>110000)
   return reply({message:"Use a valid volunteer intake preview under 100 KB."},400);
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))throw Error();
   body=JSON.stringify(value);
   if(body.length>110000)throw Error();
  }catch{return reply({message:"Check the original volunteer intake request."},400);}
 }
 try{
  const url=new URL("/api/v1/volunteers/roster"+(route?"/"+route:""),base);
  if(roster||exporting)for(const k of ["q","status","availability","branch","department",...(roster?["offset"]:[])])
   if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  const r=await fetch(url,{method,cache:"no-store",signal:AbortSignal.timeout(16000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body});
  if(r.ok)return reply(await r.json());
  const status=[400,401,403,404,409,429].includes(r.status)?r.status:503;
  return reply({message:status===401?"Sign in again.":status===403?"Current Foundation authority cannot use this action.":
   status===400?"Check the draft name, mobile, CSV format and row limits.":
   status===409?"The original intake changed. Confirm the existing batch before retrying.":
   status===429?"Too many requests; try again later.":"Volunteer operation could not be confirmed."},status);
 }catch{return reply({message:"The volunteer operation could not be confirmed. Verify existing records before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Ctx)=>request(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Ctx)=>request(req,ctx,"POST");
