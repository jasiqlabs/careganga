import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,
 headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"){
 const parts=(await ctx.params).parts??[];
 if(parts.length!==2||!UUID.test(parts[0])||
   !(parts[1]==="status"&&method==="GET"||parts[1]==="issue"&&method==="POST"))
  return reply({message:"Original document action unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"Use the authorized Foundation documents panel."},403);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return reply({message:"Sign in again to review original receipts."},401);
 if(!process.env.BACKEND_URL)return reply({message:"Document service unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return reply({message:"Check the original receipt request."},415);
  try{body=await req.text();if(body.length>2000)throw Error();JSON.parse(body);}
  catch{return reply({message:"Invalid original receipt request."},400);}
 }
 try{
  const result=await fetch(new URL("/api/documents/donation-receipts/"+parts.join("/"),
    process.env.BACKEND_URL),{method,body,cache:"no-store",signal:AbortSignal.timeout(17000),
     headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const value:unknown=await result.json().catch(()=>null);
  if(result.ok&&value!==null)return reply(value,result.status);
  return reply({message:result.status===401?"Sign in again.":
   result.status===403?"Your current Foundation role cannot issue this document.":
   result.status===404?"No eligible posted donation receipt exists.":
   result.status===409?"The original receipt changed or must be reconciled.":
   "Receipt status cannot be confirmed. Keep the original request key."},
   [400,401,403,404,409].includes(result.status)?result.status:503);
 }catch{return reply({message:"Original receipt issue result is uncertain. Check before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
