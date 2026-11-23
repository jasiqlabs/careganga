import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
type Method="GET"|"POST";
const UUID=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const json=(content:unknown,status:number)=>NextResponse.json(content,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(request:NextRequest,ctx:Context,method:Method){
 const path=(await ctx.params).parts??[];
 const canonical=path.join("/");
 const list=method==="GET"&&canonical==="redemptions/my-history";
 const create=method==="POST"&&canonical==="redemptions";
 const cancel=method==="POST"&&path.length===3&&path[0]==="redemptions"&&
  UUID.test(path[1])&&path[2]==="cancel";
 if(!list&&!create&&!cancel)return json({message:"That reward action is unavailable."},404);
 const params=request.nextUrl.searchParams;
 if([...params.keys()].some(x=>x!=="page")||params.getAll("page").length>1||
  (!list&&params.size>0)||
  (list&&params.has("page")&&!/^[1-9][0-9]{0,3}$/.test(params.get("page")??"")))
  return json({message:"Invalid reward page."},400);
 if(method==="POST"&&request.headers.get("origin")!==request.nextUrl.origin)
  return json({message:"Use the authenticated CareGanga rewards form."},403);
 const token=(await cookies()).get("cg_community_session")?.value;
 if(!token)return json({message:"Sign in to request a verified reward."},401);
 let body:string|undefined;
 if(method==="POST"){
  if(!request.headers.get("content-type")?.includes("application/json"))
   return json({message:"Reward form must use JSON."},415);
  if(create){
   try{
    const input:unknown=await request.json();
    if(!input||typeof input!=="object"||Array.isArray(input)||
      Object.keys(input).length!==5||
      Object.keys(input).some(k=>!["programmeRef","productRef","relationship",
       "expectedProductVersion","requestKey"].includes(k)))
     return json({message:"Refresh the current digital reward and try again."},400);
    body=JSON.stringify(input);if(body.length>800)return json({message:"Invalid reward request."},400);
   }catch{return json({message:"Invalid reward request."},400);}
  }else body="{}";
 }
 const backend=process.env.BACKEND_URL;
 if(!backend)return json({message:"Reward service is temporarily unavailable."},503);
 try{
  const url=new URL("/api/v1/rewards/"+canonical,backend);
  if(list&&params.has("page"))url.searchParams.set("page",params.get("page")!);
  const result=await fetch(url,{method,cache:"no-store",body,
   signal:AbortSignal.timeout(15000),headers:{
    Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const parsed:unknown=await result.json().catch(()=>null);
  if(result.ok&&parsed!==null)return json(parsed,result.status);
  const status=[400,401,403,404,409,429].includes(result.status)?result.status:503;
  return json({message:status===401?"Sign in again.":
   status===403?"Only an eligible Foundation member or volunteer can use this reward.":
   status===404?"This reward request is unavailable.":
   status===409?"The reward, available points, or original request changed. Refresh; do not create a different request key until status is confirmed.":
   status===429?"Too many reward requests. Try again shortly.":
   status===400?"Refresh the current reward and check your request.":
   "Reward outcome is uncertain. Check your original request history before retrying."},status);
 }catch{return json({message:"Reward outcome is uncertain. Refresh original request history first."},503);}
}
export const GET=(r:NextRequest,c:Context)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Context)=>proxy(r,c,"POST");
