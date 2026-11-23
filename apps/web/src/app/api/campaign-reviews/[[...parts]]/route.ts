import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts?:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const respond=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{"Cache-Control":"private, no-store"}});
async function proxy(req:NextRequest,ctx:Ctx,method:"GET"|"POST"){
 const parts=(await ctx.params).parts??[];
 const valid=parts.length===0&&method==="GET"||
   parts.length===1&&(parts[0]==="policy"||UUID.test(parts[0]))&&
    (method==="GET"||parts[0]==="policy"&&method==="POST")||
   parts.length===2&&UUID.test(parts[0])&&parts[1]==="decide"&&method==="POST";
 if(!valid)return respond({message:"Campaign review action unavailable."},404);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return respond({message:"Only authorized Foundation staff requests are accepted."},403);
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return respond({message:"Sign in to review campaigns."},401);
 const base=process.env.BACKEND_URL;
 if(!base)return respond({message:"Campaign reviews are unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return respond({message:"Use the protected campaign review form."},415);
  try{body=await req.text();if(body.length>4096)throw Error("large");JSON.parse(body);}
  catch{return respond({message:"Check campaign review form fields."},400);}
 }
 try{
  const url=new URL("/api/v1/campaign-reviews"+(parts.length?"/"+parts.join("/"):""),base);
  if(method==="GET"&&parts.length===0)for(const p of ["status","q","offset"])
   if(req.nextUrl.searchParams.has(p))url.searchParams.set(p,req.nextUrl.searchParams.get(p)!);
  const response=await fetch(url,{method,cache:"no-store",body,signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const value:unknown=await response.json().catch(()=>null);
  if(response.ok&&value!==null)return respond(value,response.status);
  const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
  const message=status===401?"Sign in again.":
   status===403?"Independent Foundation campaign-review permission is required.":
   status===404?"Current review not found.":
   status===409?"This decision or campaign revision changed. Refresh and review the latest source.":
   status===400?"Check the required review action, remarks, password and revision.":
   "Review result cannot be confirmed. Retry the original request.";
  return respond({message},status);
 }catch{return respond({message:"Review result is uncertain. Check the current case and retry the same request."},503);}
}
export const GET=(req:NextRequest,ctx:Ctx)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Ctx)=>proxy(req,ctx,"POST");
