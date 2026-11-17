import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowedMimes=new Set(["application/pdf","image/jpeg","image/png","image/webp"]);
const errors=new Set(["FINANCE_RECONCILIATION_EVIDENCE_INVALID",
 "FINANCE_RECONCILIATION_EVIDENCE_CONFLICT","FINANCE_RECONCILIATION_CONFLICT"]);
function allowed(p:string[],m:string){
 if(p.length===1&&p[0]==="intents")return m==="POST";
 if(p.length===2&&p[0]==="intents"&&UUID.test(p[1]))return m==="GET";
 if(p.length===3&&p[0]==="intents"&&UUID.test(p[1])&&p[2]==="confirm")return m==="POST";
 if(p.length===3&&p[0]==="matches"&&UUID.test(p[1])&&p[2]==="files")return m==="GET";
 if(p.length===3&&p[0]==="files"&&UUID.test(p[1])&&p[2]==="download")return m==="GET";
 return false;
}
async function handle(req:NextRequest,p:string[],method:"GET"|"POST"){
 if(!allowed(p,method))
  return NextResponse.json({message:"This private statement action is unavailable."},{status:404});
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return NextResponse.json({message:"Open this form from CareGanga Finance."},{status:403});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Session expired. Sign in again."},{status:401});
 const base=process.env.BACKEND_URL;
 if(!base)return NextResponse.json({message:"Protected bank documents are unavailable."},{status:503});
 let body:undefined|string;
 if(method==="POST"){
  try{
   const v:unknown=await req.json();
   if(!v||typeof v!=="object"||Array.isArray(v))throw Error("INVALID");
   body=JSON.stringify(v);
   if(body.length>2500)throw Error("INVALID");
  }catch{
   return NextResponse.json({message:"Choose an eligible bank match and a valid file."},{status:400});
  }
 }
 const endpoint=new URL("/api/documents/finance-bank-statements/"+p.join("/"),base);
 const download=method==="GET"&&p[0]==="files";
 try{
  const response=await fetch(endpoint,{method,body,cache:"no-store",
   signal:AbortSignal.timeout(30000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}});
  if(download&&response.ok){
   const mime=(response.headers.get("content-type")??"").split(";")[0].trim();
   const length=Number(response.headers.get("content-length")??"0");
   if(!allowedMimes.has(mime)||length>10485760)
    return NextResponse.json({message:"The private statement cannot be verified for download."},{status:503});
   const bytes=Buffer.from(await response.arrayBuffer());
   if(!bytes.length||bytes.length>10485760)
    return NextResponse.json({message:"The private statement could not be verified."},{status:503});
   const ext=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":
    mime==="image/png"?"png":"webp";
   return new NextResponse(bytes,{status:200,headers:{"Content-Type":mime,
    "Content-Disposition":'attachment; filename="CareGanga-private-bank-statement.'+ext+'"',
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  const data:unknown=await response.json().catch(()=>null);
  if(response.ok)return NextResponse.json(data,{status:response.status,
   headers:{"Cache-Control":"no-store"}});
  const obj=data&&typeof data==="object"&&!Array.isArray(data)?
   data as Record<string,unknown>:{};
  const code=typeof obj.code==="string"&&errors.has(obj.code)?obj.code:null;
  const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
  const fallback=status===403?"Your role cannot access this bank statement.":
   status===409?"The match or verified file changed. Refresh and try again.":
   status===401?"Session expired. Sign in again.":
   status===400?"Choose a valid PDF/image and the pending bank match.":
   "The private bank-statement result cannot be confirmed. Check the existing request.";
  return NextResponse.json({message:code&&typeof obj.message==="string"&&
   obj.message.length<=240?obj.message:fallback,...(code?{code}:{})},
   {status,headers:{"Cache-Control":"no-store"}});
 }catch{
  return NextResponse.json({message:"The private file result is uncertain. Check its status before retrying."},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
type Context={params:Promise<{parts:string[]}>};
export async function GET(r:NextRequest,c:Context){return handle(r,(await c.params).parts,"GET");}
export async function POST(r:NextRequest,c:Context){return handle(r,(await c.params).parts,"POST");}
