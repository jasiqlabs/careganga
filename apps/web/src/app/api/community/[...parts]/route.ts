import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
function destination(parts:string[],method:string):string|null{
 const route=parts.join("/");
 if(route==="signup/start"&&method==="POST")return "/api/identity/community/start";
 if(route==="signup"&&method==="POST")return "/api/identity/community/register";
 if(route==="login"&&method==="POST")return "/api/identity/login";
 if(route==="logout"&&method==="POST")return "/api/identity/logout";
 if(route==="mobile/status"&&method==="GET")return "/api/identity/mobile/status";
 if(route==="mobile/start"&&method==="POST")return "/api/identity/mobile/verify/start";
 if(route==="mobile/confirm"&&method==="POST")return "/api/identity/mobile/verify/confirm";
 if(route==="volunteers/applications"&&["GET","POST"].includes(method))return "/api/v1/volunteers/applications";
 if(route==="volunteers/applications/options"&&method==="GET")return "/api/v1/volunteers/applications/options";
 if(parts.length===3&&parts[0]==="volunteers"&&parts[1]==="applications"&&UUID.test(parts[2])&&["GET","PATCH"].includes(method))
  return "/api/v1/volunteers/applications/"+parts[2];
 if(parts.length===4&&parts[0]==="volunteers"&&parts[1]==="applications"&&UUID.test(parts[2])&&["submit","cancel","activate"].includes(parts[3])&&method==="POST")
  return "/api/v1/volunteers/applications/"+parts[2]+"/"+parts[3];
 if(route==="volunteers/me"&&method==="GET")return "/api/v1/volunteers/me";
 if(route==="volunteers/documents/me"&&method==="GET")return "/api/v1/volunteers/documents/me";
 if(parts.length===5&&parts[0]==="volunteers"&&parts[1]==="documents"&&parts[2]==="cards"&&UUID.test(parts[3])&&parts[4]==="download"&&method==="GET")
  return "/api/v1/volunteers/documents/cards/"+parts[3]+"/download";
  if(route==="volunteers/documents/intents"&&method==="POST")return "/api/documents/volunteer/intents";
 if(parts.length===4&&parts[0]==="volunteers"&&parts[1]==="documents"&&parts[2]==="intents"&&UUID.test(parts[3])&&method==="GET")
  return "/api/documents/volunteer/intents/"+parts[3];
 if(parts.length===5&&parts[0]==="volunteers"&&parts[1]==="documents"&&parts[2]==="intents"&&UUID.test(parts[3])&&parts[4]==="confirm"&&method==="POST")
  return "/api/documents/volunteer/intents/"+parts[3]+"/confirm";
 if(parts.length===5&&parts[0]==="volunteers"&&parts[1]==="documents"&&parts[2]==="applications"&&UUID.test(parts[3])&&parts[4]==="files"&&method==="GET")
  return "/api/documents/volunteer/applications/"+parts[3]+"/files";
 if(parts.length===5&&parts[0]==="volunteers"&&parts[1]==="documents"&&parts[2]==="files"&&UUID.test(parts[3])&&["download","revoke"].includes(parts[4])&&((parts[4]==="download"&&method==="GET")||(parts[4]==="revoke"&&method==="POST")))
  return "/api/documents/volunteer/files/"+parts[3]+"/"+parts[4];
  if(route==="applications"&&["GET","POST"].includes(method))return "/api/v1/membership/applications";
 if(route==="applications/options"&&method==="GET")return "/api/v1/membership/applications/options";
 if(parts.length===2&&parts[0]==="applications"&&UUID.test(parts[1])&&["GET","PATCH"].includes(method))
  return "/api/v1/membership/applications/"+parts[1];
 if(parts.length===3&&parts[0]==="applications"&&UUID.test(parts[1])&&["submit","cancel","activate"].includes(parts[2])&&method==="POST")
  return "/api/v1/membership/applications/"+parts[1]+"/"+parts[2];
 if(parts.length===3&&parts[0]==="applications"&&UUID.test(parts[1])&&parts[2]==="fee"&&method==="GET")
  return "/api/v1/membership/applications/"+parts[1]+"/fee";
 if(route==="me"&&method==="GET")return "/api/v1/membership/me";
 if(route==="me/history"&&method==="GET")return "/api/v1/membership/me/history";
 if(route==="documents/me"&&method==="GET")return "/api/v1/membership/documents/me";
 if(parts.length===5&&parts[0]==="documents"&&parts[1]==="packs"&&UUID.test(parts[2])&&["CARD","CERTIFICATE","WELCOME"].includes(parts[3])&&parts[4]==="download"&&method==="GET")return "/api/v1/membership/documents/packs/"+parts[2]+"/"+parts[3]+"/download";
 if(route==="documents/intents"&&method==="POST")return "/api/documents/membership/intents";
 if(parts.length===3&&parts[0]==="documents"&&parts[1]==="intents"&&UUID.test(parts[2])&&method==="GET")return "/api/documents/membership/intents/"+parts[2];
 if(parts.length===4&&parts[0]==="documents"&&parts[1]==="intents"&&UUID.test(parts[2])&&parts[3]==="confirm"&&method==="POST")return "/api/documents/membership/intents/"+parts[2]+"/confirm";
 if(parts.length===4&&parts[0]==="documents"&&parts[1]==="applications"&&UUID.test(parts[2])&&parts[3]==="files"&&method==="GET")return "/api/documents/membership/applications/"+parts[2]+"/files";
 if(parts.length===4&&parts[0]==="documents"&&parts[1]==="files"&&UUID.test(parts[2])&&parts[3]==="download"&&method==="GET")return "/api/documents/membership/files/"+parts[2]+"/download";
 if(parts.length===4&&parts[0]==="documents"&&parts[1]==="files"&&UUID.test(parts[2])&&parts[3]==="revoke"&&method==="POST")return "/api/documents/membership/files/"+parts[2]+"/revoke";
 return null;
}
async function proxy(request:NextRequest,ctx:Ctx,method:"GET"|"POST"|"PATCH"){
 const parts=(await ctx.params).parts;
 const target=destination(parts,method);
 if(!target)return reply({message:"That membership action is unavailable."},404);
 const route=parts.join("/");
 if(method!=="GET"&&request.headers.get("origin")!==request.nextUrl.origin)return reply({message:"Submit this form from the CareGanga website."},403);
 const publicRoute=["signup/start","signup","login"].includes(route);
 const session=(await cookies()).get("cg_community_session")?.value;
 if(!publicRoute&&!session)return reply({message:"Sign in to manage your own membership application."},401);
 const backend=process.env.BACKEND_URL;
 if(!backend)return reply({message:"Membership service is temporarily unavailable."},503);
 let body:string|undefined;
 if(method!=="GET"&&route!=="logout"){
  try{const raw:unknown=await request.json();if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("Invalid");
   body=JSON.stringify(raw);if(body.length>9000)throw Error("Too large");
  }catch{return reply({message:"Check the membership form details."},400);}
 }
 try{
  const url=new URL(target,backend);
  if(["applications/options","volunteers/applications/options"].includes(route)){
   for(const field of ["stateRef","branchRef"])if(request.nextUrl.searchParams.has(field))
    url.searchParams.set(field,request.nextUrl.searchParams.get(field)!);
  }
  if(route==="login"){
   const x=JSON.parse(body??"{}") as Record<string,unknown>;
   body=JSON.stringify({identifier:x.identifier,password:x.password,deviceLabel:"CareGanga Membership Web"});
  }
  const r=await fetch(url,{method,body,cache:"no-store",signal:AbortSignal.timeout(15000),
   headers:{...(session&&!publicRoute?{Authorization:"Bearer "+session}:{}),...(body?{"Content-Type":"application/json"}:{})}});
  if(!r.ok){
   const status=[400,401,403,404,409,429].includes(r.status)?r.status:503;
   const error:unknown=await r.json().catch(()=>null);
   const v=error&&typeof error==="object"&&!Array.isArray(error)?error as Record<string,unknown>:{};
   const publicMessage=typeof v.message==="string"&&v.message.length<250&&
     /^CG04_|^CG19_|^CG01_/.test(String(v.code??""))?v.message:null;
   return reply({message:publicMessage??(status===401?"Sign in again.":status===403?"Your account cannot perform this action.":status===404?"Your membership record is unavailable.":status===409?"This application or document changed. Refresh before continuing.":status===429?"Too many attempts. Try again later.":status===400?"Check the form and selected options.":"The outcome could not be confirmed. Refresh before retrying.")},status);
  }
  if(route==="logout"){
   const out=reply({signedOut:true});
   out.cookies.set("cg_community_session","",{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",maxAge:0});return out;
  }
  if(route==="login"){
   const v:unknown=await r.json();
   const s=v&&typeof v==="object"?v as Record<string,unknown>:{};
   if(typeof s.sessionToken!=="string"||typeof s.expiresAt!=="string"||!Number.isFinite(Date.parse(s.expiresAt))||Date.parse(s.expiresAt)<=Date.now())return reply({message:"Sign-in could not be confirmed."},503);
   const out=reply({signedIn:true});
   out.cookies.set("cg_community_session",s.sessionToken,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",expires:new Date(s.expiresAt)});return out;
  }
  if((route.startsWith("documents/files/")||route.startsWith("documents/packs/")||(route.startsWith("volunteers/documents/files/")||route.startsWith("volunteers/documents/cards/")))&&route.endsWith("/download")){
   const type=r.headers.get("Content-Type")??"application/octet-stream";
   if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(type.split(";")[0].trim()))return reply({message:"Protected document unavailable."},503);
   const bytes=await r.arrayBuffer();
   if(bytes.byteLength>10485760)return reply({message:"Protected document is too large."},503);
   return new NextResponse(bytes,{status:200,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff","Content-Type":type,"Content-Disposition":'attachment; filename="CareGanga-original-private-document"'}});
  }
  const v:unknown=await r.json();return reply(v,r.status);
 }catch{return reply({message:"The result is uncertain. Refresh the application status before trying again."},503);}
}
export const GET=(r:NextRequest,c:Ctx)=>proxy(r,c,"GET");
export const POST=(r:NextRequest,c:Ctx)=>proxy(r,c,"POST");
export const PATCH=(r:NextRequest,c:Ctx)=>proxy(r,c,"PATCH");
