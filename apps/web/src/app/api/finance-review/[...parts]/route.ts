import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function route(parts:string[],method:string){
 if(method==="GET"&&parts.length===1&&["process","cases"].includes(parts[0]))
  return parts[0]==="cases"?"":parts[0];
 if(method==="POST"&&parts.length===2&&parts[0]==="process"&&parts[1]==="initialize")
  return "process/initialize";
 if(method==="GET"&&parts.length===1&&UUID.test(parts[0]))return parts[0];
 if(method==="POST"&&parts.length===2&&UUID.test(parts[0])&&parts[1]==="decisions")
  return parts[0]+"/decisions";
 return null;
}
async function handle(req:NextRequest,parts:string[],method:string){
 const suffix=route(parts,method);
 if(suffix===null)return NextResponse.json({message:"This finance review action is unavailable."},{status:404});
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return NextResponse.json({message:"Use the protected Finance review form."},{status:403});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Session expired. Sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Finance reviewer service is unavailable."},{status:503});
 let body:string|undefined;
 if(method==="POST"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))throw Error("FORM");
   body=JSON.stringify(value);
   if(body.length>2400)throw Error("FORM");
  }catch{return NextResponse.json({message:"Check the reviewer decision and current password."},{status:400});}
 }
 try{
  const response=await fetch(new URL("/api/registration-approvals/finance-vouchers"+
   (suffix?"/"+suffix:""),backend),{method,body,cache:"no-store",
    signal:AbortSignal.timeout(14000),
    headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const raw:unknown=await response.json().catch(()=>null);
  if(response.ok)return NextResponse.json(raw,{status:response.status,
   headers:{"Cache-Control":"private, no-store"}});
  const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
  const known=typeof obj.code==="string"&&[
    "FINANCE_VOUCHER_REVIEW_INVALID","FINANCE_VOUCHER_REVIEW_UNAVAILABLE",
    "FINANCE_VOUCHER_STALE","FINANCE_VOUCHER_REPLAY_CONFLICT"
  ].includes(obj.code)?obj.code:null;
  return NextResponse.json({message:known&&typeof obj.message==="string"&&obj.message.length<301?
    obj.message:status===401?"Session expired. Sign in again.":
    status===403?"A currently authorized Foundation Super Admin reviewer is required.":
    status===409?"The review or current source changed. Refresh before deciding.":
    status===429?"Too many confirmation attempts. Try again later.":
    status===400?"Check the reviewer action and current password.":
    "The original decision cannot be confirmed. Check its status before retrying.",
    ...(known?{code:known}:{})},
   {status,headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json(
   {message:"The original review result is uncertain. Refresh the case before repeating it."},
   {status:503,headers:{"Cache-Control":"private, no-store"}});}
}
type Ctx={params:Promise<{parts:string[]}>};
export async function GET(req:NextRequest,c:Ctx){return handle(req,(await c.params).parts,"GET");}
export async function POST(req:NextRequest,c:Ctx){return handle(req,(await c.params).parts,"POST");}
