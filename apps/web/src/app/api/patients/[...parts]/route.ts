import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const CODES=new Set([
 "CG15_PATIENT_INVALID","CG15_PATIENT_NOT_REGISTERED","CG15_PATIENT_FORBIDDEN",
 "CG15_PATIENT_CONTACT_UNVERIFIED","CG15_PATIENT_CONSENT_REQUIRED",
 "CG15_PATIENT_CONSENT_UNAVAILABLE","CG15_PATIENT_CHANGED",
 "CG15_PATIENT_REQUEST_CONFLICT","CG15_PATIENT_ALREADY_REGISTERED",
 "IDENTITY_LOGIN_INVALID","IDENTITY_IDENTIFIER_INVALID","IDENTITY_PASSWORD_REQUIRED",
 "CG01_PUBLIC_SIGNUP_INVALID","CG01_PUBLIC_SIGNUP_LIMIT","CG01_PUBLIC_SIGNUP_EXISTS",
 "CG01_PUBLIC_SIGNUP_UNAVAILABLE","CG01_PUBLIC_SIGNUP_CONFLICT"
]);
function reject(status:number,message:string,code?:string){
 return NextResponse.json({message,...(code?{code}:{})},
  {status,headers:{"Cache-Control":"no-store"}});
}
const authorized=(parts:string[],method:string)=>{
 const route=parts.join("/");
 return route==="policy"&&method==="GET"||
  route==="login"&&method==="POST"||
  route==="signup"&&method==="POST"||
  route==="signup/start"&&method==="POST"||
  route==="logout"&&method==="POST"||
  route==="mobile/status"&&method==="GET"||
  route==="mobile/start"&&method==="POST"||
  route==="mobile/confirm"&&method==="POST"||
  route==="me"&&["GET","PATCH"].includes(method)||
  route==="me/consent"&&method==="POST"||
  route==="registration"&&method==="POST";
};
async function handler(request:NextRequest,parts:string[],method:string){
 if(!authorized(parts,method))return reject(404,"This patient action is unavailable.");
 if(method!=="GET"&&request.headers.get("origin")!==request.nextUrl.origin)
  return reject(403,"Please submit the form from the CareGanga website.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return reject(503,"Patient records are temporarily unavailable.");
 const route=parts.join("/");
 let body:string|undefined;
 if(method!=="GET"&&route!=="logout"){
  try{
   const value:unknown=await request.json();
   if(!value||typeof value!=="object"||Array.isArray(value))
    throw Error("payload");
   body=JSON.stringify(value);
   if(body.length>6000)throw Error("size");
  }catch{return reject(400,"Check the patient form and try again.");}
 }
 const cookie=(await cookies()).get("cg_patient_session")?.value;
 if(route!=="policy"&&route!=="login"&&route!=="signup"&&route!=="signup/start"&&!cookie)
  return reject(401,"Sign in to access your own patient information.");
 const path=route==="mobile/status"?"/api/identity/mobile/status":
  route==="mobile/start"?"/api/identity/mobile/verify/start":
  route==="mobile/confirm"?"/api/identity/mobile/verify/confirm":
  route==="policy"?"/api/v1/patients/consent-policy":
  route==="signup"?"/api/identity/patients/register":
  route==="signup/start"?"/api/identity/patients/start":
  route==="login"?"/api/identity/login":
  route==="logout"?"/api/identity/logout":
  "/api/v1/patients/"+route;
 try{
  let data=body;
  if(route==="login"){
   const parsed=JSON.parse(body??"{}") as Record<string,unknown>;
   data=JSON.stringify({identifier:parsed.identifier,password:parsed.password,
    deviceLabel:"CareGanga Patient Web"});
  }
  const r=await fetch(new URL(path,backend),{
   method,body:data,cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{...(cookie&&route!=="login"&&route!=="signup"&&route!=="signup/start"&&route!=="policy"?
    {Authorization:"Bearer "+cookie}:{}),
    ...(data?{"Content-Type":"application/json"}:{})}
  });
  if(!r.ok){
   const status=[400,401,403,404,409,429].includes(r.status)?r.status:503;
   const raw:unknown=await r.json().catch(()=>null);
   const obj=raw&&typeof raw==="object"&&!Array.isArray(raw)?
    raw as Record<string,unknown>:{};
   const code=typeof obj.code==="string"&&CODES.has(obj.code)?obj.code:undefined;
   const message=code&&typeof obj.message==="string"&&obj.message.length<=220?
    obj.message:status===401?"The mobile/email or password could not be confirmed.":
    status===403?"Your account cannot perform this patient action.":
    status===404?"No patient profile is linked to this account yet.":
    status===409?"Your patient profile changed. Refresh before trying again.":
    status===429?"Too many attempts. Please try again later.":
    status===400?"Check the information and consent before submitting.":
    "The result could not be confirmed. Refresh before retrying.";
   return reject(status,message,code);
  }
  if(route==="logout"){
   const reply=NextResponse.json({signedOut:true},{headers:{"Cache-Control":"no-store"}});
   reply.cookies.set("cg_patient_session","",{httpOnly:true,path:"/",maxAge:0,
    secure:process.env.NODE_ENV==="production",sameSite:"strict"});
   return reply;
  }
  const value:unknown=await r.json();
  if(route==="login"){
   if(!value||typeof value!=="object"||!("sessionToken" in value)||
    typeof value.sessionToken!=="string"||!("expiresAt" in value)||
    typeof value.expiresAt!=="string"||
    !Number.isFinite(Date.parse(value.expiresAt))||
    Date.parse(value.expiresAt)<=Date.now())
    return reject(503,"Sign-in cannot be confirmed right now.");
   const reply=NextResponse.json({signedIn:true},{headers:{"Cache-Control":"no-store"}});
   reply.cookies.set("cg_patient_session",value.sessionToken,{
    httpOnly:true,secure:process.env.NODE_ENV==="production",
    sameSite:"strict",path:"/",expires:new Date(value.expiresAt)});
   return reply;
  }
  return NextResponse.json(value,{status:r.status,headers:{"Cache-Control":"no-store"}});
 }catch{
  return reject(503,"The result is uncertain. Refresh this page before trying again.");
 }
}
export async function GET(request:NextRequest,ctx:Context){
 return handler(request,(await ctx.params).parts,"GET");
}
export async function POST(request:NextRequest,ctx:Context){
 return handler(request,(await ctx.params).parts,"POST");
}
export async function PATCH(request:NextRequest,ctx:Context){
 return handler(request,(await ctx.params).parts,"PATCH");
}
