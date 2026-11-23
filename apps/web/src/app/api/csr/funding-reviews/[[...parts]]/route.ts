import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const result=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(req:NextRequest,context:Context,method:"GET"|"POST"){
 const parts=(await context.params).parts??[];
 const isAgreement=method==="GET"&&parts.length===2&&UUID.test(parts[0])&&parts[1]==="agreement";
 const valid=(method==="GET"&&(parts.length===0||parts.length===1&&(parts[0]==="policy"||UUID.test(parts[0]))||isAgreement))||
  (method==="POST"&&(parts.length===1&&parts[0]==="policy"||parts.length===2&&UUID.test(parts[0])&&parts[1]==="decide"));
 if(!valid)return result({message:"Funding review action is unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return result({message:"Funding review request origin denied."},403);
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return result({message:"Sign in again."},401);
 if(!process.env.BACKEND_URL)return result({message:"Funding review service unavailable."},503);
 let data:string|undefined;
 if(method==="POST"){
  if(!req.headers.get("content-type")?.includes("application/json"))return result({message:"Use the private Funding review form."},415);
  try{data=await req.text();if(data.length>3500)throw Error();JSON.parse(data);}catch{return result({message:"Check the Funding review fields."},400);}
 }
 try{
  const url=new URL("/api/v1/csr-funding-reviews"+(parts.length?"/"+parts.join("/"):""),process.env.BACKEND_URL);
  if(method==="GET"&&parts.length===0){
   for(const key of ["q","status","offset"])if(req.nextUrl.searchParams.has(key))url.searchParams.set(key,req.nextUrl.searchParams.get(key)!);
  }
  const upstream=await fetch(url,{method,cache:"no-store",body:data,headers:{Authorization:"Bearer "+session,...(data?{"Content-Type":"application/json"}:{})},signal:AbortSignal.timeout(16000)});
  if(isAgreement&&upstream.ok){
   const mime=upstream.headers.get("content-type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime)||!upstream.body)
    return result({message:"Verified private Funding agreement is unavailable."},503);
   return new Response(upstream.body,{status:200,headers:{
    "Content-Type":mime,
    "Content-Disposition":'attachment; filename="CareGanga-private-funding-review-proof"',
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"
   }});
  }
  const response:unknown=await upstream.json().catch(()=>null);
  if(upstream.ok&&response!==null)return result(response,upstream.status);
  return result({message:upstream.status===401?"Sign in again.":upstream.status===403?"Your current protected role cannot review this application.":
   upstream.status===404?"Funding review unavailable.":upstream.status===409?"Funding case changed; refresh before deciding.":
   upstream.status===400?"Check the Funding reviewer password, action or remarks.":"Funding review result is uncertain; refresh before retrying."},
   [400,401,403,404,409,429].includes(upstream.status)?upstream.status:503);
 }catch{return result({message:"Funding review result is uncertain; check the case before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
