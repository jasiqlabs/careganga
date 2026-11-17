import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx={params:Promise<{parts:string[]}>};
export async function GET(request:NextRequest,ctx:Ctx){
 const parts=(await ctx.params).parts;
 const status=parts.length===3&&parts[0]==="invoices"&&ID.test(parts[1])&&parts[2]==="status";
 const download=parts.length===3&&parts[0]==="files"&&ID.test(parts[1])&&parts[2]==="download";
 if(!status&&!download)return NextResponse.json({message:"Private document action unavailable."},{status:404});
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return NextResponse.json({message:"Session expired. Sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Private document provider is unavailable."},{status:503});
 try{
  const res=await fetch(new URL("/api/documents/finance-invoice/"+parts.join("/"),backend),{
   cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{Authorization:"Bearer "+session}});
  if(download&&res.ok){
   const type=res.headers.get("content-type")?.split(";")[0];
   const length=Number(res.headers.get("content-length")??"0");
   if(type!=="application/pdf"||(length!==0&&(length<100||length>10485760)))
    throw new Error("Unconfirmed PDF");
   const bytes=await res.arrayBuffer();
   if(bytes.byteLength<100||bytes.byteLength>10485760)throw new Error("Unconfirmed PDF");
   return new NextResponse(bytes,{status:200,headers:{
    "Content-Type":"application/pdf","Content-Disposition":
      'attachment; filename="CareGanga-Foundation-Invoice.pdf"',
    "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
  }
  if(res.ok)return NextResponse.json(await res.json(),{headers:{"Cache-Control":"private, no-store"}});
  const responseStatus=[400,401,403,404,409,429].includes(res.status)?res.status:503;
  return NextResponse.json({message:responseStatus===401?"Sign in again.":
   responseStatus===403?"Your role cannot access this private document.":
   responseStatus===404?"The original document is not issued.":
   "This original invoice PDF cannot be confirmed. Refresh its current status."},{
    status:responseStatus,headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({message:"Private document is unavailable. Its original state has not been confirmed."},
  {status:503,headers:{"Cache-Control":"private, no-store"}});}
}
