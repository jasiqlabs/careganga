import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{fileRef:string}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MIME=new Set(["image/png","image/jpeg","image/webp","application/pdf","video/mp4"]);
const cap=(mime:string)=>mime==="video/mp4"?26214400:10485760;
const NO_STORE={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"};
/** Same-origin only: source verification and revocation are performed on
 * every CG19 backend read, including HTTP Range requests. Never redirect
 * the visitor to an object-storage URL or forward arbitrary client headers.
 */
export async function GET(request:NextRequest,context:Context){
 const {fileRef}=await context.params;
 if(!UUID.test(fileRef))return new NextResponse(null,{status:404,headers:NO_STORE});
 const backend=process.env.BACKEND_URL;
 if(!backend)return new NextResponse(null,{status:503,headers:NO_STORE});
 const range=request.headers.get("range");
 // Forward only a single bounded byte-range expression. Unsupported request
 // forms cannot turn into a backend bypass or multipart/unknown output.
 if(range&&(range.length>80||!/^bytes=\d*-\d*$/.test(range)||
   range==="bytes=-"))
  return new NextResponse(null,{status:416,headers:NO_STORE});
 try{
  const url=new URL("/api/public/content/media/"+fileRef,backend);
  const response=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:range?{Range:range}:undefined});
  if(response.status===404)return new NextResponse(null,{status:404,headers:NO_STORE});
  if(response.status===416){
   const contentRange=response.headers.get("content-range")??"";
   return new NextResponse(null,{status:416,headers:{
    ...NO_STORE,...(contentRange?{"Content-Range":contentRange}:{}),
    "Accept-Ranges":"bytes"}});
  }
  if(response.status!==200&&response.status!==206)
   return new NextResponse(null,{status:503,headers:NO_STORE});
  const type=response.headers.get("content-type")?.split(";")[0]?.trim()??"";
  const declared=Number(response.headers.get("content-length")??"0");
  if(!MIME.has(type)||!Number.isSafeInteger(declared)||
    declared>cap(type)||declared<1)
   return new NextResponse(null,{status:503,headers:NO_STORE});
  const partial=response.status===206;
  const contentRange=response.headers.get("content-range")??"";
  if(partial&&(!range||type!=="video/mp4"||
    !/^bytes \d+-\d+\/\d+$/.test(contentRange)))
   return new NextResponse(null,{status:503,headers:NO_STORE});
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength===0||bytes.byteLength>cap(type)||
    declared!==bytes.byteLength)
   return new NextResponse(null,{status:503,headers:NO_STORE});
  return new NextResponse(bytes,{status:partial?206:200,headers:{
   ...NO_STORE,
   "Content-Type":type,"Content-Length":String(bytes.byteLength),
   ...(type==="video/mp4"?{"Accept-Ranges":"bytes"}:{}),
   ...(partial?{"Content-Range":contentRange}:{}),
   "Content-Disposition":type==="application/pdf"?"attachment":"inline",
   "Content-Security-Policy":"default-src 'none'; sandbox"
  }});
 }catch{return new NextResponse(null,{status:503,headers:NO_STORE});}
}
