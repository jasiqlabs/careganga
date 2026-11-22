import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const respond=(valid:boolean,status:"ACTIVE"|"NOT_VALID"="NOT_VALID",http=200)=>NextResponse.json({valid,status},{status:http,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
/** Public code-only eligibility check, no private member identity or PDF bytes. */
export async function POST(req:NextRequest){
 if(req.headers.get("origin")!==req.nextUrl.origin)return respond(false,"NOT_VALID",403);
 if(!req.headers.get("content-type")?.includes("application/json"))return respond(false,"NOT_VALID",400);
 let code:string;
 try{
  if(Number(req.headers.get("content-length")??0)>256)return respond(false,"NOT_VALID",400);
  const v:unknown=await req.json();
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length!==1||typeof (v as {code?:unknown}).code!=="string")
   return respond(false,"NOT_VALID",400);
  code=(v as {code:string}).code.trim().toUpperCase();
  if(!/^CGV-[A-F0-9]{24}$/.test(code))return respond(false);
 }catch{return respond(false,"NOT_VALID",400);}
 const base=process.env.BACKEND_URL;
 if(!base)return respond(false,"NOT_VALID",503);
 try{
  const r=await fetch(new URL("/api/v1/public/membership/verify/"+encodeURIComponent(code),base),{cache:"no-store",signal:AbortSignal.timeout(10000)});
  if(!r.ok)return respond(false,"NOT_VALID",503);
  const v:unknown=await r.json();
  if(!v||typeof v!=="object"||Array.isArray(v))return respond(false,"NOT_VALID",503);
  if((v as {valid?:unknown}).valid===true&&(v as {status?:unknown}).status==="ACTIVE")return respond(true,"ACTIVE");
  if((v as {valid?:unknown}).valid===false&&(v as {status?:unknown}).status==="NOT_VALID")return respond(false);
  return respond(false,"NOT_VALID",503);
 }catch{return respond(false,"NOT_VALID",503);}
}
