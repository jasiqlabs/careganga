import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{action:string}>};
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"){
 const action=(await ctx.params).action;
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
 if(!(action==="summary"&&method==="GET"||action==="export"&&method==="POST"))return reply({message:"Action unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Request origin not allowed."},403);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);if(!base)return reply({message:"Summary unavailable."},503);
 try{const url=new URL("/api/v1/operations/"+action,base);let body:string|undefined;
 if(method==="GET"){const scope=req.nextUrl.searchParams.get("scope");if(scope)url.searchParams.set("scope",scope);}
 else{body=await req.text();if(body.length>1024)return reply({message:"Invalid export."},400);}
 const r=await fetch(url,{method,body,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000)});
 const v=await r.json().catch(()=>null);if(r.ok&&v!==null)return reply(v,r.status);
 return reply({message:r.status===403?"Your current role does not permit this summary or export.":r.status===401?"Sign in again.":"Summary or export unavailable. Refresh and retry."},r.ok?503:r.status);
 }catch{return reply({message:"Summary or export unavailable. Refresh and retry."},503);}
}
export const GET=(r:NextRequest,c:Context)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Context)=>proxy(r,c,"POST");
