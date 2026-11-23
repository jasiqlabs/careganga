import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const id=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"|"PATCH"){
 const p=(await ctx.params).parts??[];
 const valid=p.length===0&&(method==="GET"||method==="POST")
  ||p.length===1&&(method==="GET"&&(p[0]==="options"||id.test(p[0]))||method==="PATCH"&&id.test(p[0]))
  ||p.length===2&&id.test(p[0])&&((p[1]==="cancel"||p[1]==="submit"||p[1]==="public-release")&&method==="POST"||(p[1]==="review-history"||p[1]==="public-release")&&method==="GET")
  ||p.length===3&&id.test(p[0])&&p[1]==="public-release"&&p[2]==="withdraw"&&method==="POST";
 if(!valid)return reply({message:"CSR action unavailable."},404);
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply({message:"CSR changes must originate from the staff panel."},403);
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return reply({message:"Sign in again."},401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply({message:"CSR service unavailable."},503);
 let body:string|undefined;
 if(method!=="GET"){
  if(!req.headers.get("content-type")?.includes("application/json"))
   return reply({message:"Use the CSR application form."},415);
  try{body=await req.text();if(body.length>12000)throw Error();JSON.parse(body);}
  catch{return reply({message:"Check the CSR application details."},400);}
 }
 try{
  const url=new URL("/api/v1/csr/partners"+(p.length?"/"+p.join("/"):""),backend);
  if(method==="GET"&&(p.length===0||p[0]==="options"))
   for(const key of ["q","status","branchRef","offset"])
    if(req.nextUrl.searchParams.has(key))url.searchParams.set(key,req.nextUrl.searchParams.get(key)!);
  const r=await fetch(url,{method,headers:{Authorization:"Bearer "+session,...(body?{"Content-Type":"application/json"}:{})},
   body,cache:"no-store",signal:AbortSignal.timeout(12000)});
  const v:unknown=await r.json().catch(()=>null);
  if(r.ok&&v!==null)return reply(v,r.status);
  return reply({message:r.status===401?"Sign in again.":r.status===403?"Your current role or branch cannot access this CSR record.":
   r.status===404?"CSR partner unavailable in your permitted scope.":
   r.status===409?"This partner changed or already exists. Refresh and review the current record.":
   r.status===400?"Check the organization and contact fields.":"The saved result cannot be confirmed. Check the partner list before retrying."},
   [400,401,403,404,409,429].includes(r.status)?r.status:503);
 }catch{return reply({message:"The result cannot be confirmed. Check the partner list before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
export const PATCH=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"PATCH");
