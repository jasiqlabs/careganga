import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts?:string[]}>};
const uid=(v:string)=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store"}});
async function proxy(req:NextRequest,ctx:Context,method:"GET"|"POST"){
 const p=(await ctx.params).parts??[];
 const valid=p.length===0||method==="GET"&&(p.length===1&&p[0]==="options"||p.length===2&&uid(p[0])&&["history","review","fulfillment","payment-options"].includes(p[1]))||method==="POST"&&(p.length===2&&uid(p[0])&&["submit","deliver-material","deliver-financial","return","confirm-handover"].includes(p[1])||p.length===3&&p[0]==="review-cases"&&uid(p[1])&&p[2]==="decide");
 if(!valid)return json({message:"Assistance action unavailable"},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return json({message:"Request origin not allowed"},403);
 const token=(await cookies()).get("cg_staff_session")?.value;if(!token)return json({message:"Sign in again"},401);
 const base=process.env.BACKEND_URL;if(!base)return json({message:"Assistance service unavailable"},503);
 try{
  const u=new URL("/api/v1/assistance"+(p.length?"/"+p.join("/"):""),base);
  const beneficiary=req.nextUrl.searchParams.get("beneficiaryRef");if(beneficiary&&uid(beneficiary))u.searchParams.set("beneficiaryRef",beneficiary);
  let body:string|undefined;if(method==="POST"){body=await req.text();if(body.length>16384)return json({message:"Check assistance fields"},400);}
  const r=await fetch(u,{method,body,headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},cache:"no-store",signal:AbortSignal.timeout(15000)});
  const result=await r.json().catch(()=>null);if(r.ok&&result!==null)return json(result,r.status);
  return json({message:r.status===401?"Sign in again":r.status===403?"Your current role or branch cannot perform this action":r.status===404?"Assistance unavailable":r.status===409?"The original approval, owner source or available quantity changed. Refresh before retrying.":r.status===400?"Check the assistance details":"Outcome not confirmed. Refresh and retry with the original request."},r.ok?503:r.status);
 }catch{return json({message:"Outcome not confirmed. Refresh and retry with the original request."},503);}
}
export const GET=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Context)=>proxy(req,ctx,"POST");
