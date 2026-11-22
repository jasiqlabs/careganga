import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
async function proxy(req:NextRequest,ctx:Ctx,method:"GET"|"POST"){
 const p=(await ctx.params).parts,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
 const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed."},403);
 if(!(p.length===1&&p[0]==="policy"||p.length===2&&p[0]==="visits"&&uuid.test(p[1])&&method==="GET"||p.length===3&&uuid.test(p[1])&&method==="POST"&&(p[0]==="visits"&&["submit"].includes(p[2])||p[0]==="cases"&&p[2]==="decide")))return reply({message:"Visit review action unavailable."},404);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);
 if(!base)return reply({message:"Review service unavailable."},503);
 try{
  let body:string|undefined;if(method==="POST"){body=await req.text();if(body.length>8192)return reply({message:"Check eligibility fields."},400);}
  const r=await fetch(new URL("/api/v1/field-visit-review/"+p.join("/"),base),{method,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body,cache:"no-store",signal:AbortSignal.timeout(15000)});
  const v=await r.json().catch(()=>null);
  if(r.ok&&v!==null)return reply(v,r.status);
  const safeMessages=["Complete check-in and check-out and save your visit report before submitting.","Add verified supporting evidence because the visit location is unverified.","Choose the review route and enter your current password.","No distinct eligible reviewers are available for this visit review route. Ask a Foundation administrator to check the review setup.","Enter your current Foundation password to confirm the decision.","The final reviewer must approve, send back or reject."];
  if([400,409].includes(r.status)&&typeof v?.message==="string"&&safeMessages.includes(v.message))return reply({message:v.message},r.status);
  return reply({message:r.status===401?"Sign in again.":r.status===403?"Your current role cannot perform this review.":r.status===409?"The original visit or review changed. Refresh before retrying.":r.status===400?"Check the required report, supporting evidence and password.":"Review result could not be confirmed."},r.ok?503:r.status);
 }catch{return reply({message:"Review result could not be confirmed."},503);}
}
export const GET=(r:NextRequest,c:Ctx)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Ctx)=>proxy(r,c,"POST");
