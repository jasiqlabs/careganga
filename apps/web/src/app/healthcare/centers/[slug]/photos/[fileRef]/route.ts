import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{slug:string;fileRef:string}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const slugValid=/^[a-z0-9][a-z0-9-]{2,79}$/;
const unavailable=()=>new NextResponse(null,{
 status:404,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}
});
export async function GET(_req:NextRequest,{params}:Ctx){
 const {slug,fileRef}=await params;
 if(!slugValid.test(slug)||!UUID.test(fileRef))return unavailable();
 const backend=process.env.BACKEND_URL;
 if(!backend)return unavailable();
 try{
  const source=await fetch(new URL("/api/documents/health-center-content/public/"+
   encodeURIComponent(slug)+"/"+encodeURIComponent(fileRef),backend),{
   cache:"no-store",signal:AbortSignal.timeout(10000)
  });
  if(!source.ok)return unavailable();
  const mime=source.headers.get("content-type");
  const length=Number(source.headers.get("content-length")??0);
  if(!["image/jpeg","image/png"].includes(mime??"")||
    !Number.isFinite(length)||length>3*1024*1024)return unavailable();
  const bytes=await source.arrayBuffer();
  if(bytes.byteLength>3*1024*1024||bytes.byteLength<40)return unavailable();
  // No public cache/storage of a withdrawn or rights-revoked image.
  return new NextResponse(bytes,{headers:{
   "Content-Type":mime!,
   "Cache-Control":"no-store, max-age=0, must-revalidate",
   "X-Content-Type-Options":"nosniff",
   "Referrer-Policy":"no-referrer",
   "Content-Security-Policy":"default-src 'none'; sandbox"
  }});
 }catch{return unavailable();}
}
