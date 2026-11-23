import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
type Method="GET"|"POST"|"PATCH";
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const response=(body:unknown,status:number)=>NextResponse.json(body,{status,headers:{
 "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
function route(parts:string[],method:Method):{target:string;isSelf:boolean}|null{
 const segment=parts.join("/");
 if(segment==="my-catalog"&&method==="GET")return {target:"my-catalog",isSelf:true};
 if(segment==="catalogue-programmes"&&method==="GET")
  return {target:segment,isSelf:false};
 if(segment==="programmes"&&(method==="GET"||method==="POST"))
  return {target:segment,isSelf:false};
 if(parts.length===2&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  (method==="GET"||method==="PATCH"))
  return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="status"&&method==="POST")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="programmes"&&UUID.test(parts[1])&&
  parts[2]==="products"&&method==="GET")return {target:segment,isSelf:false};
 if(segment==="products"&&method==="POST")return {target:segment,isSelf:false};
 if(parts.length===2&&parts[0]==="products"&&UUID.test(parts[1])&&method==="PATCH")
  return {target:segment,isSelf:false};
 if(segment==="stock-options"&&method==="GET")return {target:segment,isSelf:false};
 if(parts.length===3&&parts[0]==="stock-preview"&&
  UUID.test(parts[1])&&UUID.test(parts[2])&&method==="GET")
  return {target:segment,isSelf:false};

 return null;
}
async function proxy(req:NextRequest,ctx:Context,method:Method){
 const path=route((await ctx.params).parts??[],method);
 if(!path)return response({message:"That referral or reward action is unavailable."},404);
 const params=req.nextUrl.searchParams;
 const page=params.get("page");
 const paged=method==="GET"&&(path.target==="programmes"||path.target==="catalogue-programmes"||
  path.target==="my-catalog"||path.target.endsWith("/products"));
 if([...params.keys()].some(k=>k!=="page")||
    params.getAll("page").length>1||
    (page!==null&&(!paged||!(/^[1-9][0-9]{0,3}$/).test(page))))
  return response({message:"Invalid catalogue page."},400);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return response({message:"Use the authenticated CareGanga form."},403);
 const cookieName=path.isSelf?"cg_community_session":"cg_staff_session";
 const token=(await cookies()).get(cookieName)?.value;
 if(!token)return response({message:path.isSelf?
  "Sign in as an eligible member or volunteer.":"Sign in to the Foundation admin panel."},401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return response({message:"Original reward catalogue temporarily unavailable."},503);
 let body:string|undefined;
 if(method!=="GET"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return response({message:"Use the correct reward form."},415);
  try{
   const raw:unknown=await req.json();
   if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error();
   body=JSON.stringify(raw);
   if(body.length>12000)throw Error();
  }catch{return response({message:"Check current programme and reward fields."},400);}
 }
 try{
  const url=new URL("/api/v1/referrals/"+path.target,backend);
  if(page!==null)url.searchParams.set("page",page);
  const result=await fetch(url,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const decoded:unknown=await result.json().catch(()=>null);
  if(result.ok&&decoded!==null)return response(decoded,result.status);
  const status=[400,401,403,404,409,429].includes(result.status)?result.status:503;
  return response({message:status===401?"Sign in again.":status===403?
   "Your current role or membership cannot access that reward source.":status===404?
   "Original programme or reward unavailable.":status===409?
   "This source was changed or already recorded. Refresh and retry the same request.":
   status===400?"Check the real programme rules, rank thresholds and eligible product fields.":
   "Result uncertain. Refresh original records before submitting again."},status);
 }catch{return response({message:"Result uncertain. Refresh original records before submitting again."},503);}
}
export const GET=(r:NextRequest,c:Context)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Context)=>proxy(r,c,"POST");
export const PATCH=(r:NextRequest,c:Context)=>proxy(r,c,"PATCH");
