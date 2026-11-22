import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const respond=(body:unknown,status=200)=>NextResponse.json(body,{status,
 headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"){
 const parts=(await ctx.params).parts??[];
 const path=parts.length===0&&method==="GET"?"/api/v1/donations":
  parts.join("/")==="manual/queue"&&method==="GET"?"/api/v1/donations/manual/queue":
  ["manual/options","manual/prepare"].includes(parts.join("/"))&&method==="POST"?
    "/api/v1/donations/"+parts.join("/"):
  parts.length===3&&parts[0]==="manual"&&UUID.test(parts[1])&&parts[2]==="confirm"&&method==="POST"?
    "/api/v1/donations/manual/"+parts[1]+"/confirm":null;
 if(!path)return respond({message:"Donation action unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return respond({message:"Use the current Foundation staff panel to verify a donation."},403);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return respond({message:"Sign in again to access donation records."},401);
 if(!process.env.BACKEND_URL)return respond({message:"Donation service is temporarily unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return respond({message:"Use the donation form to submit this request."},415);
  try{body=await req.text();if(body.length>8000)throw Error();JSON.parse(body);}
  catch{return respond({message:"Check the donation request details."},400);}
 }
 try{
  const url=new URL(path,process.env.BACKEND_URL);
  if(method==="GET"&&parts.length===0)
   for(const key of ["status","q","offset"])
    if(req.nextUrl.searchParams.has(key))url.searchParams.set(key,req.nextUrl.searchParams.get(key)!);
  const r=await fetch(url,{method,body,cache:"no-store",signal:AbortSignal.timeout(16000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const value:unknown=await r.json().catch(()=>null);
  if(r.ok&&value!==null)return respond(value,r.status);
  const code=[400,401,403,404,409,429].includes(r.status)?r.status:503;
  return respond({message:code===400?"Check the donation amount, cash voucher and account selections.":
   code===401?"Sign in again.":code===403?"Your current role or Foundation branch cannot perform this donation action.":
   code===404?"Donation or private status proof unavailable.":code===409?
    "Donation changed or cash voucher was already used. Refresh before continuing.":
   code===429?"Too many requests. Try again shortly.":
    "Donation verification result cannot be confirmed. Retry with the same request."},code);
 }catch{return respond({message:"The donation outcome is uncertain. Check the original voucher before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
