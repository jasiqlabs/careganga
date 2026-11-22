import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts?:string[]}>};
const id=/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const reply=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
function path(parts:string[],method:"GET"|"POST"):string|null{
 if(parts.length===0&&method==="GET")return "/api/v1/membership/reviews";
 if(parts.length===1&&parts[0]==="policy")return "/api/v1/membership/reviews/policy";
 if(parts.length===1&&id.test(parts[0])&&method==="GET")return "/api/v1/membership/reviews/"+parts[0];
 if(parts.length===2&&id.test(parts[0])&&parts[1]==="decide"&&method==="POST")return "/api/v1/membership/reviews/"+parts[0]+"/decide";
 if(parts.length===4&&id.test(parts[0])&&parts[1]==="files"&&id.test(parts[2])&&parts[3]==="download"&&method==="GET")
  return "/api/v1/membership/reviews/"+parts[0]+"/files/"+parts[2]+"/download";
 return null;
}
async function proxy(req:NextRequest,ctx:Ctx,method:"GET"|"POST"){
 const parts=(await ctx.params).parts??[],target=path(parts,method);
 if(!target)return reply({message:"Membership review action unavailable."},404);
 if(method==="POST"&&req.headers.get("origin")!==req.nextUrl.origin)return reply({message:"Review must be submitted from the Foundation admin panel."},403);
 const token=(await cookies()).get("cg_staff_session")?.value,base=process.env.BACKEND_URL;
 if(!token)return reply({message:"Sign in again."},401);
 if(!base)return reply({message:"Membership approval service unavailable."},503);
 let body:string|undefined;
 if(method==="POST"){
  try{const x:unknown=await req.json();if(!x||typeof x!=="object"||Array.isArray(x))throw Error("body");
   body=JSON.stringify(x);if(body.length>4000)throw Error("size");
  }catch{return reply({message:"Check the approval form details."},400);}
 }
 try{
  const url=new URL(target,base);
  if(parts.length===0&&method==="GET")for(const k of ["status","offset","q","category","payment","submittedFrom","submittedTo"])if(req.nextUrl.searchParams.has(k))url.searchParams.set(k,req.nextUrl.searchParams.get(k)!);
  const r=await fetch(url,{method,cache:"no-store",signal:AbortSignal.timeout(13000),
   headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},body});
  if(!r.ok){
   const status=[400,401,403,404,409,429].includes(r.status)?r.status:503;
   return reply({message:status===401?"Sign in again.":status===403?"Your current protected approval permission is unavailable.":status===404?"This membership application is no longer available.":status===409?"The case or proof changed. Refresh before reviewing.":status===429?"Too many requests. Try again later.":status===400?"Check the approval inputs and your current password.":"The review outcome could not be confirmed. Refresh before retrying."},status);
  }
  if(parts.length===4&&parts[1]==="files"){
   const mime=(r.headers.get("Content-Type")??"").split(";")[0].trim();
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))return reply({message:"Protected document type unavailable."},503);
   const bytes=await r.arrayBuffer();if(bytes.byteLength<1||bytes.byteLength>10485760)return reply({message:"Protected document unavailable."},503);
   return new NextResponse(bytes,{status:200,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Type":mime,"Content-Disposition":'attachment; filename="CareGanga-protected-membership-proof"'}});
  }
  return reply(await r.json(),r.status);
 }catch{return reply({message:"The protected review outcome is uncertain. Refresh its actual status."},503);}
}
export const GET=(r:NextRequest,c:Ctx)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Ctx)=>proxy(r,c,"POST");
