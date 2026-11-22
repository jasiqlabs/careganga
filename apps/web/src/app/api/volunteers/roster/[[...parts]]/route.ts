import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts?:string[]}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
export async function GET(req:NextRequest,ctx:Ctx){
 const parts=(await ctx.params).parts??[];
 const reimbursement=parts.length===2&&UUID.test(parts[0])&&parts[1]==="reimbursement-options";
 if(!reimbursement&&(parts.length>1||parts.length===1&&parts[0]!=="export"))return reply({message:"Volunteer roster action unavailable."},404);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply({message:"Sign in again."},401);
 const base=process.env.BACKEND_URL;
 if(!base)return reply({message:"Volunteer roster unavailable."},503);
 try{
  const url=new URL("/api/v1/volunteers/roster"+(reimbursement?"/"+parts.join("/"):parts.length?"/export":""),base);
  for(const k of (reimbursement?[]:["q","status","availability","branch","department",...(parts.length?[]:["offset"])]))
   if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  const r=await fetch(url,{headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(r.ok){const data:unknown=await r.json();return reply(data);}
  return reply({message:r.status===401?"Sign in again.":r.status===403?"Your current role or location cannot view these volunteer records.":r.status===400?"Check the volunteer roster filters.":r.status===409?"Volunteer roster changed. Refresh the filters.":"Volunteer records could not be confirmed."},[400,401,403,409].includes(r.status)?r.status:503);
 }catch{return reply({message:"Volunteer records could not be confirmed. Refresh before retrying."},503);}
}
