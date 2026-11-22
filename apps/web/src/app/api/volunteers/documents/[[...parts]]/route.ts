import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts?:string[]}>};
type Method="GET"|"POST";
const uuid=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
function route(parts:string[],method:Method):{path:string;binary:boolean}|null{
 const route=parts.join("/");
 if(method==="GET"&&parts.length===2&&parts[0]==="volunteers"&&uuid.test(parts[1]))return {path:route,binary:false};
 if(method==="POST"&&parts.length===3&&parts[0]==="volunteers"&&uuid.test(parts[1])&&parts[2]==="issue")return {path:route,binary:false};
 if(method==="GET"&&parts.length===2&&parts[0]==="cards"&&uuid.test(parts[1]))return {path:route,binary:false};
 if(method==="POST"&&parts.length===3&&parts[0]==="cards"&&uuid.test(parts[1])&&["reconcile","revoke"].includes(parts[2]))return {path:route,binary:false};
 if(method==="GET"&&parts.length===3&&parts[0]==="cards"&&uuid.test(parts[1])&&parts[2]==="download")return {path:route,binary:true};
 return null;
}
async function proxy(req:NextRequest,ctx:Ctx,method:Method){
 const p=route((await ctx.params).parts??[],method);
 if(!p)return reply({message:"Official volunteer card action is unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Submit this request through the Foundation admin panel."},403);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);
 if(!base)return reply({message:"Official volunteer cards are unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  if(!req.headers.get("content-type")?.includes("application/json"))return reply({message:"Check the document request."},400);
  try{const data:unknown=await req.json();if(!data||typeof data!=="object"||Array.isArray(data))throw Error();
   body=JSON.stringify(data);if(body.length>10000)throw Error();
  }catch{return reply({message:"Check the document request."},400);}
 }
 try{
  const url=new URL("/api/v1/volunteers/documents/"+p.path,base);
  const r=await fetch(url,{method,cache:"no-store",signal:AbortSignal.timeout(20000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body});
  if(!r.ok){
   const status=[400,401,403,404,409,429].includes(r.status)?r.status:503;
   return reply({message:status===400?"Check the original volunteer card request.":status===401?"Sign in again.":status===403?"Your role cannot manage these official documents.":status===404?"Official volunteer card is unavailable.":status===409?"The volunteer eligibility, approved brand or card changed. Refresh before retrying.":status===429?"Too many requests. Try later.":"The official document outcome is uncertain. Refresh before retrying."},status);
  }
  if(p.binary){
   const mime=(r.headers.get("content-type")??"").split(";")[0].trim();
   if(mime!=="application/pdf")return reply({message:"Verified official PDF unavailable."},503);
   const bytes=await r.arrayBuffer();
   if(bytes.byteLength<1||bytes.byteLength>10485760)return reply({message:"Verified official PDF unavailable."},503);
   return new NextResponse(bytes,{headers:{"Content-Type":"application/pdf","Cache-Control":"private, no-store","Content-Disposition":'attachment; filename="CareGanga-official-volunteer-card.pdf"',"X-Content-Type-Options":"nosniff"}});
  }
  return reply(await r.json());
 }catch{return reply({message:"Official document result uncertain. Refresh the actual status before retrying."},503);}
}
export const GET=(req:NextRequest,ctx:Ctx)=>proxy(req,ctx,"GET");
export const POST=(req:NextRequest,ctx:Ctx)=>proxy(req,ctx,"POST");
