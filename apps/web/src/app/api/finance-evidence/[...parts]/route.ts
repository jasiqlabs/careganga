import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const mime=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
function allowed(p:string[],method:string){
 if(p.length===1&&p[0]==="intents")return method==="POST";
 if(p.length===2&&p[0]==="intents"&&UUID.test(p[1]))return method==="GET";
 if(p.length===3&&p[0]==="intents"&&UUID.test(p[1])&&p[2]==="confirm")return method==="POST";
 if(p.length===3&&p[0]==="vouchers"&&UUID.test(p[1])&&["files","payment-files"].includes(p[2]))return method==="GET";
 if(p.length===3&&p[0]==="files"&&UUID.test(p[1])&&p[2]==="revoke")return method==="POST";
 if(p.length===3&&p[0]==="files"&&UUID.test(p[1])&&p[2]==="download")return method==="GET";
 return false;
}
async function handle(req:NextRequest,parts:string[],method:string){
 if(!allowed(parts,method))return NextResponse.json({message:"This private evidence action is unavailable."},{status:404});
 if(method!=="GET"&&req.headers.get("origin")!==req.nextUrl.origin)
  return NextResponse.json({message:"Open the evidence form from CareGanga Admin."},{status:403});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Session expired. Sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Private evidence service is unavailable."},{status:503});
 const target=new URL("/api/documents/finance-voucher-evidence/"+parts.join("/"),backend);
 if(method==="GET"&&parts[0]==="vouchers"){
  const version=req.nextUrl.searchParams.get("version");
  if(!version||!/^[1-9][0-9]{0,5}$/.test(version))
   return NextResponse.json({message:"Check the voucher version before viewing files."},{status:400});
  target.searchParams.set("version",version);
 }
 let body:string|undefined;
 if(method==="POST"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))throw Error("FORM");
   body=JSON.stringify(value);
   if(body.length>4000)throw Error("FORM");
  }catch{return NextResponse.json({message:"Check the private evidence request details."},{status:400});}
 }
 try{
  const res=await fetch(target,{method,body,cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  const download=method==="GET"&&parts[0]==="files"&&parts[2]==="download";
  if(res.ok&&download){
   const type=res.headers.get("content-type")?.split(";")[0]??"";
   if(!mime.has(type))return NextResponse.json({message:"The private file type could not be verified."},{status:503});
   const bytes=await res.arrayBuffer();
   if(bytes.byteLength<1||bytes.byteLength>10485760)
    return NextResponse.json({message:"The private file size could not be verified."},{status:503});
   return new NextResponse(bytes,{status:200,headers:{
    "Content-Type":type,"Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
    "Content-Disposition":'attachment; filename="CareGanga-private-voucher-evidence"'}});
  }
  const raw:unknown=await res.json().catch(()=>null);
  if(res.ok)return NextResponse.json(raw,{status:res.status,headers:{"Cache-Control":"private, no-store"}});
  const data=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw as Record<string,unknown>:{};
  const status=[400,401,403,404,409,429].includes(res.status)?res.status:503;
  const safeCode=typeof data.code==="string"&&[
   "FINANCE_VOUCHER_EVIDENCE_INVALID","FINANCE_VOUCHER_EVIDENCE_CONFLICT",
   "FINANCE_VOUCHER_STALE","FINANCE_VOUCHER_NOT_EDITABLE","FINANCE_PERMISSION"
  ].includes(data.code)?data.code:null;
  const message=safeCode&&typeof data.message==="string"&&data.message.length<=300?
   data.message:status===401?"Session expired. Sign in again.":
   status===403?"Your role is not authorized to access this private voucher evidence.":
   status===409?"This voucher or file changed. Refresh and verify it before continuing.":
   status===400?"Check the private evidence details before continuing.":
   "The private file result cannot be verified. Check the original request before retrying.";
  return NextResponse.json({message,...(safeCode?{code:safeCode}:{})},
   {status,headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({message:"The original file result cannot be verified. Check its status before retrying."},
  {status:503,headers:{"Cache-Control":"private, no-store"}});}
}
type Ctx={params:Promise<{parts:string[]}>};
export async function GET(req:NextRequest,ctx:Ctx){return handle(req,(await ctx.params).parts,"GET");}
export async function POST(req:NextRequest,ctx:Ctx){return handle(req,(await ctx.params).parts,"POST");}
