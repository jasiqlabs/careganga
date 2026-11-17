import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{fileRef:string}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MIME=new Set(["image/png","image/jpeg","image/webp","application/pdf","video/mp4"]);
const cap=(mime:string)=>mime==="video/mp4"?26214400:10485760;
/** Same-origin public read-through. No storage key or presigned CG19 URL
 * leaves the backend and every read rechecks current publication/rights.
 */
export async function GET(_request:NextRequest,context:Context){
 const {fileRef}=await context.params;
 if(!UUID.test(fileRef))return new NextResponse(null,{status:404});
 const backend=process.env.BACKEND_URL;
 if(!backend)return new NextResponse(null,{status:503});
 try{
  const url=new URL("/api/public/content/media/"+fileRef,backend);
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(response.status===404)return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
  if(!response.ok)return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});
  const type=response.headers.get("content-type")?.split(";")[0]?.trim()??"";
  const declared=Number(response.headers.get("content-length")??"0");
  if(!MIME.has(type)||!Number.isFinite(declared)||declared>cap(type))
   return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength===0||bytes.byteLength>cap(type))
   return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});
  return new NextResponse(bytes,{status:200,headers:{
   "Content-Type":type,"Content-Length":String(bytes.byteLength),
    "Content-Disposition":type==="application/pdf"?"attachment":"inline",
   "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
   "Content-Security-Policy":"default-src 'none'; sandbox"
  }});
 }catch{return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});}
}
