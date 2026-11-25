import {cookies} from "next/headers";
export const dynamic="force-dynamic";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Ctx={params:Promise<{fileRef:string}>};
const missing=()=>new Response(null,{status:404,headers:{"Cache-Control":"private, no-store"}});
export async function GET(_req:Request,ctx:Ctx){
 const {fileRef}=await ctx.params;
 const release=/^release-([a-z-]{1,45})$/.exec(fileRef);
 if(!UUID.test(fileRef)&&!release)return missing();
 const session=(await cookies()).get("cg_staff_session")?.value;
 const backend=process.env.BACKEND_URL;
 if(!session||!backend)return missing();
 try{
  const res=await fetch(new URL(release?"/api/cms/release-media/preview/"+release[1]:"/api/cms/media/preview/"+fileRef,backend),{
   method:"GET",cache:"no-store",headers:{Authorization:"Bearer "+session},
   signal:AbortSignal.timeout(12000)});
  if(!res.ok)return missing();
  const type=res.headers.get("content-type")?.split(";")[0]?.trim();
  if(!type||!["image/jpeg","image/png","image/webp"].includes(type))return missing();
  const bytes=await res.arrayBuffer();
  if(bytes.byteLength<1||bytes.byteLength>10*1024*1024)return missing();
  return new Response(bytes,{status:200,headers:{"Content-Type":type,
   "Cache-Control":"private, no-store","X-Robots-Tag":"noindex",
   "Cross-Origin-Resource-Policy":"same-origin",
   "X-Content-Type-Options":"nosniff"}});
 }catch{return missing();}
}
