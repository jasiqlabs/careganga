import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reply=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"){
 const p=(await ctx.params).parts??[];
 const valid=method==="POST"&&(p.length===1&&p[0]==="intents"||p.length===3&&p[0]==="intents"&&UUID.test(p[1])&&p[2]==="confirm")||
 method==="GET"&&p.length===2&&["intents","proposals","files"].includes(p[0])&&UUID.test(p[1]);
 if(!valid)return reply({message:"Private CSR funding agreement action unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Private document request origin not allowed."},403);
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return reply({message:"Sign in again."},401);
 const base=process.env.BACKEND_URL;if(!base)return reply({message:"Secure CSR funding documents unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  if(!req.headers.get("content-type")?.includes("application/json"))return reply({message:"Use the private funding agreement form."},415);
  try{body=await req.text();if(body.length>8000)throw Error();JSON.parse(body);}
  catch{return reply({message:"Check agreement file details."},400);}
 }
 try{
  const upstream=await fetch(new URL("/api/v1/csr-funding-agreements/"+p.join("/"),base),{
   method,body,headers:{Authorization:"Bearer "+session,...(body?{"Content-Type":"application/json"}:{})},
   cache:"no-store",signal:AbortSignal.timeout(30000)});
  if(method==="GET"&&p[0]==="files"&&upstream.ok){
   const mime=upstream.headers.get("content-type")?.split(";")[0]??"";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime)||!upstream.body)
    return reply({message:"Verified private funding agreement is unavailable."},503);
   return new Response(upstream.body,{status:200,headers:{"Content-Type":mime,"Content-Disposition":'attachment; filename="CareGanga-private-CSR-funding-agreement"',
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"}});
  }
  const result:unknown=await upstream.json().catch(()=>null);
  if(upstream.ok&&result!==null)return reply(result,upstream.status);
  return reply({message:upstream.status===401?"Sign in again.":upstream.status===403?"Your current role or branch cannot access this private funding agreement.":
    upstream.status===404?"Private CSR funding agreement unavailable.":upstream.status===409?"Funding proposal or agreement changed. Refresh before continuing.":
    upstream.status===400?"Choose an allowed private PDF or image up to 10 MB.":
    "Secure document status cannot be confirmed. Check the existing upload before retrying."},
    [400,401,403,404,409,429].includes(upstream.status)?upstream.status:503);
 }catch{return reply({message:"The private funding agreement result is uncertain. Check the original upload status."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
