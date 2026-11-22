import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest){
 const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
 const base=process.env.BACKEND_URL;if(!base)return reply({message:"Membership plans temporarily unavailable."},503);
 try{
  const url=new URL("/api/v1/public/membership/tiers",base);
  for(const k of ["q","category","cursor"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  const r=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!r.ok)return reply({message:r.status===400?"Check your plan filters.":"Membership plans temporarily unavailable."},r.status===400?400:503);
  const v=await r.json();
  if(!Array.isArray(v?.items)||!(v.nextCursor===null||typeof v.nextCursor==="string"))throw Error("Invalid source");
  return reply(v);
 }catch{return reply({message:"Membership plans temporarily unavailable."},503);}
}
