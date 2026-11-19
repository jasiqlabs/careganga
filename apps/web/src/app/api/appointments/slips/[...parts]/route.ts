import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function allowed(p:string[],method:string){
 return p.length===3&&p[0]==="me"&&ID.test(p[1])&&
  (method==="GET"&&["status","file","restricted-file"].includes(p[2])||
   method==="POST"&&["issue","download-grant"].includes(p[2]))||
  p.length===1&&p[0]==="verify"&&method==="POST";
}
const reply=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"no-store"}});
async function forward(req:NextRequest,parts:string[],method:"GET"|"POST"){
 if(!allowed(parts,method))return reply(404,"This slip action is unavailable.");
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)
  return reply(403,"Submit this request from CareGanga.");
 const isGrantedRead=parts.length===3&&parts[2]==="restricted-file";
 const grant=isGrantedRead?req.nextUrl.searchParams.get("grant"):null;
 if(isGrantedRead&&(!grant||!/^[0-9]{10}\.[a-f0-9]{64}$/.test(grant)))
  return reply(400,"This private document authorization is invalid or expired.");
 if([...req.nextUrl.searchParams.keys()].some(k=>!isGrantedRead||k!=="grant"))
  return reply(400,"Unexpected private document request parameters.");
 const publicCheck=parts[0]==="verify";
 const token=publicCheck?null:(await cookies()).get("cg_patient_session")?.value;
 if(!publicCheck&&!token)return reply(401,"Sign in to your patient profile to access your slip.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply(503,"The consultation document service is unavailable.");
 let body:string|undefined;
 if(method==="POST"){
  try{
   const value:unknown=await req.json();
   if(!value||typeof value!=="object"||Array.isArray(value))throw Error("payload");
   body=JSON.stringify(value);
   if(body.length>200)throw Error("length");
  }catch{return reply(400,"Check the verification token or request reference.");}
 }
 try{
  const target=new URL("/api/v1/appointments/slips/"+parts.join("/"),backend);
  if(isGrantedRead&&grant)target.searchParams.set("grant",grant);
  const result=await fetch(target,{
   method,body,cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{...(token?{Authorization:"Bearer "+token}:{}),
    ...(body?{"Content-Type":"application/json"}:{})}
  });
  if(result.ok&&["file","restricted-file"].includes(parts[2])){
   const type=result.headers.get("Content-Type");
   if(!type?.includes("application/pdf"))
    return reply(503,"The original PDF cannot be verified.");
   const bytes=await result.arrayBuffer();
   if(bytes.byteLength<100||bytes.byteLength>10485760)
    return reply(503,"The original PDF cannot be verified.");
   return new NextResponse(bytes,{headers:{
    "Content-Type":"application/pdf",
    "Content-Disposition":"attachment; filename=careganga-consultation.pdf",
    "Cache-Control":"private, no-store",
    "Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}});
  }
  const data:unknown=await result.json().catch(()=>null);
  if(!result.ok){
   const status=[400,401,403,404,409,429].includes(result.status)?result.status:503;
   return reply(status,status===401?"Your patient session expired. Sign in again.":
    status===403?"Your patient account does not have access to this slip.":
    status===404?"This slip is not issued or is no longer valid.":
    status===409?"The appointment changed. Refresh and issue the current version.":
    status===429?"Too many verification attempts. Try later.":
    status===400?"Check the status-only QR code or issue request.":
    "The original private document result is uncertain. Check its current status.");
  }
  return NextResponse.json(data,{status:result.status,
   headers:{"Cache-Control":publicCheck?"no-store":"private, no-store"}});
 }catch{return reply(503,"The private document result is uncertain. Check status before retrying.");}
}
export async function GET(req:NextRequest,ctx:Context){
 return forward(req,(await ctx.params).parts,"GET");
}
export async function POST(req:NextRequest,ctx:Context){
 return forward(req,(await ctx.params).parts,"POST");
}
