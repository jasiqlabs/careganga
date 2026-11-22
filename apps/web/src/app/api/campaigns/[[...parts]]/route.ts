import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const parts=(await ctx.params).parts??[];
 const valid=parts.length===0&&(method==="GET"||method==="POST")||
   parts.length===1&&(UUID.test(parts[0])||parts[0]==="options")&&method==="GET"||
   parts.length===2&&UUID.test(parts[0])&&(parts[1]==="draft"&&method==="PATCH"||(parts[1]==="submit"||parts[1]==="lifecycle")&&method==="POST"||parts[1]==="review-history"&&method==="GET");
 if(!valid)return reply({message:"Campaign action unavailable."},404);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"This campaign request must originate from the Foundation staff panel."},403);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply({message:"Sign in again to access Foundation campaigns."},401);
 if(!process.env.BACKEND_URL)return reply({message:"Campaign service is temporarily unavailable."},503);
 let body:string|undefined;
 if(method!=="GET"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return reply({message:"Use the campaign form to save this draft."},415);
  try{body=await req.text();if(body.length>35000)throw Error();JSON.parse(body);}
  catch{return reply({message:"Campaign details are too large or invalid."},400);}
 }
 try{
  const url=new URL("/api/v1/campaigns"+(parts.length?"/"+parts.join("/"):""),process.env.BACKEND_URL);
  if(method==="GET"&&(parts.length===0||parts[0]==="options"))for(const key of (parts[0]==="options"?["q","stateRef","branchRef"]:["q","offset","status"]))
   if(req.nextUrl.searchParams.has(key))url.searchParams.set(key,req.nextUrl.searchParams.get(key)!);
  const r=await fetch(url,{method,body,cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const v:unknown=await r.json().catch(()=>null);
  if(r.ok&&v!==null)return reply(v,r.status);
  const code=[400,401,403,404,409,429].includes(r.status)?r.status:503;
  return reply({message:code===401?"Sign in again.":code===403?"Your current role or branch cannot perform this campaign action.":
   code===404?"Campaign unavailable in your Foundation scope.":code===409?"Campaign changed or its independent approval is not configured. Refresh or contact the Foundation administrator.":
   code===400?"Check the campaign title, amounts, dates and six-step information.":
   "Campaign result cannot be confirmed. Retry the original request."},code);
 }catch{return reply({message:"Campaign result is uncertain. Check the saved campaign before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"PATCH");
