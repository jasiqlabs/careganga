import {cookies} from "next/headers";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const MIME=new Set(["image/jpeg","image/png","image/webp","application/pdf","video/mp4"]);
type Ctx={params:Promise<{fileRef:string}>};
const missing=()=>new Response(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
/** Same real CG01 session and CG19 owner proof as image preview.
 * Private PDF/video bytes never receive a shareable signed URL or cache.
 */
export async function GET(_req:Request,ctx:Ctx){
 const {fileRef}=await ctx.params;
 if(!UUID.test(fileRef))return missing();
 const token=(await cookies()).get("cg_staff_session")?.value;
 const backend=process.env.BACKEND_URL;
 if(!token||!backend)return missing();
 try{
  const res=await fetch(new URL("/api/cms/media/preview/"+fileRef,backend),{
   cache:"no-store",headers:{Authorization:"Bearer "+token},
   signal:AbortSignal.timeout(15000)});
  if(!res.ok)return missing();
  const type=res.headers.get("content-type")?.split(";")[0]?.trim()??"";
  if(!MIME.has(type))return missing();
  const max=type==="video/mp4"?26214400:10485760;
  const declared=Number(res.headers.get("content-length")??"0");
  if(!Number.isFinite(declared)||declared>max)return missing();
  const bytes=await res.arrayBuffer();
  if(bytes.byteLength<1||bytes.byteLength>max)return missing();
  return new Response(bytes,{status:200,headers:{
   "Content-Type":type,"Content-Length":String(bytes.byteLength),
   "Content-Disposition":type==="application/pdf"?"attachment":"inline",
   "Cache-Control":"private, no-store",
   "X-Robots-Tag":"noindex, nofollow, noarchive",
   "Cross-Origin-Resource-Policy":"same-origin","X-Content-Type-Options":"nosniff",
   "Content-Security-Policy":"default-src 'none'; sandbox"
  }});
 }catch{return missing();}
}
