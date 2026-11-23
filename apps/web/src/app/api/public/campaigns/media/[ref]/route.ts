import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{ref:string}>};
const valid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_req:NextRequest,{params}:Context){
 const {ref}=await params;
 const fail=(status:number)=>NextResponse.json({message:"This original campaign image is unavailable."},
  {status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 if(!valid.test(ref))return fail(404);
 if(!process.env.BACKEND_URL)return fail(503);
 try{
  const response=await fetch(new URL("/api/public/campaigns/media/"+ref,process.env.BACKEND_URL),
   {cache:"no-store",signal:AbortSignal.timeout(9000)});
  if(!response.ok)return fail(response.status===404?404:503);
  const mime=response.headers.get("content-type")?.split(";")[0];
  if(!mime||!["image/jpeg","image/png","image/webp"].includes(mime))return fail(503);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<1||bytes.byteLength>5*1024*1024)return fail(503);
  return new NextResponse(bytes,{headers:{"Content-Type":mime,"Cache-Control":"no-store, no-cache, must-revalidate","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noimageindex","Content-Disposition":"inline"}});
 }catch{return fail(503);}
}
