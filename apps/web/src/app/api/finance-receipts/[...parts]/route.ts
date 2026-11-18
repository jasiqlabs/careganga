import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx={params:Promise<{parts:string[]}>};
async function handler(request:NextRequest,ctx:Ctx){
 const parts=(await ctx.params).parts;
 const status=parts.length===3&&parts[0]==="receipts"&&ID.test(parts[1])&&parts[2]==="status";
 const issue=parts.length===3&&parts[0]==="receipts"&&ID.test(parts[1])&&parts[2]==="issue";
 const download=parts.length===3&&parts[0]==="files"&&ID.test(parts[1])&&parts[2]==="download";
 if(!status&&!issue&&!download)return NextResponse.json({message:"Private document action unavailable."},{status:404});
 if(issue&&request.method!=="POST"||!issue&&request.method!=="GET")
  return NextResponse.json({message:"Private receipt action unavailable."},{status:405});
 if(issue&&request.headers.get("origin")!==request.nextUrl.origin)
  return NextResponse.json({message:"Open the original CareGanga Finance receipt form."},{status:403});
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return NextResponse.json({message:"Session expired. Sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Private document provider is unavailable."},{status:503});
 try{
  let body:string|undefined;
  if(issue){
   try{
    const v:unknown=await request.json();
    if(!v||typeof v!=="object"||Array.isArray(v)||
      Object.keys(v).some(k=>k!=="requestKey")||
      !("requestKey" in v)||typeof v.requestKey!=="string"||!ID.test(v.requestKey))
     throw Error("Invalid");
    body=JSON.stringify(v);
   }catch{return NextResponse.json({message:"Check the original receipt issue request."},{status:400});}
  }
  const res=await fetch(new URL("/api/documents/finance-receipts/"+parts.join("/"),backend),{
   method:issue?"POST":"GET",body,cache:"no-store",
   signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+session,...(body?{"Content-Type":"application/json"}:{})}});
  if(download&&res.ok){
   const type=res.headers.get("content-type")?.split(";")[0];
   const length=Number(res.headers.get("content-length")??"0");
   if(type!=="application/pdf"||(length!==0&&(length<100||length>10485760)))
    throw new Error("Unconfirmed PDF");
   const bytes=await res.arrayBuffer();
   if(bytes.byteLength<100||bytes.byteLength>10485760)throw new Error("Unconfirmed PDF");
   return new NextResponse(bytes,{status:200,headers:{
    "Content-Type":"application/pdf","Content-Disposition":
      'attachment; filename="CareGanga-Foundation-Receipt.pdf"',
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  if(res.ok)return NextResponse.json(await res.json(),{headers:{"Cache-Control":"private, no-store"}});
  const responseStatus=[400,401,403,404,409,429].includes(res.status)?res.status:503;
  return NextResponse.json({message:responseStatus===401?"Sign in again.":
   responseStatus===403?"Your role cannot access this private document.":
   responseStatus===404?"The original document is not issued.":
   "This original receipt PDF cannot be confirmed. Refresh its current status."},{
    status:responseStatus,headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({message:"Private document is unavailable. Its original state has not been confirmed."},
  {status:503,headers:{"Cache-Control":"private, no-store"}});}
}

export async function GET(request:NextRequest,ctx:Ctx){return handler(request,ctx);}
export async function POST(request:NextRequest,ctx:Ctx){return handler(request,ctx);}
