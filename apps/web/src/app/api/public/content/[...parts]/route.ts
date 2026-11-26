import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function GET(_req:NextRequest,ctx:Ctx){
 const parts=(await ctx.params).parts;
 const page=parts.length===2&&parts[0]==="pages"&&
  /^[a-z0-9-]{1,70}$/.test(parts[1]);
 const media=parts.length===2&&((parts[0]==="media"&&UUID.test(parts[1]))||(parts[0]==="release-media"&&/^[a-z-]{1,45}$/.test(parts[1])));
 if(!page&&!media)return new NextResponse(null,{status:404});
 const backend=process.env.BACKEND_URL;
 if(!backend)return new NextResponse(null,{status:503});
 try{
  const url=new URL("/api/public/content/"+parts.join("/"),backend);
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000)});
  if(res.status===404)return new NextResponse(null,{status:404,headers:{"Cache-Control":"no-store"}});
  if(!res.ok)return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});
  if(page){
   const data:unknown=await res.json();
   if(!data||typeof data!=="object"||Array.isArray(data)||
     !("effectiveGeneration" in data))
    return new NextResponse(null,{status:503});
   return NextResponse.json(data,{headers:{"Cache-Control":"no-store",
    "X-Content-Type-Options":"nosniff"}});
  }
  const mime=res.headers.get("content-type")??"";
  if(!["image/png","image/jpeg","image/webp"].some(x=>mime.startsWith(x)))
   return new NextResponse(null,{status:503});
  const data=await res.arrayBuffer();
  if(data.byteLength<100||data.byteLength>10*1024*1024)
   return new NextResponse(null,{status:503});
  return new NextResponse(data,{headers:{"Content-Type":mime,
   "Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return new NextResponse(null,{status:503,headers:{"Cache-Control":"no-store"}});}
}
