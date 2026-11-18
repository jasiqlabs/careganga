import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest) {
  const origin=request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin)
    return NextResponse.json({message:"Request could not be completed"},{status:403});
  const backend=process.env.BACKEND_URL;
  if(!backend) return NextResponse.json({message:"Sign-in unavailable"},{status:503});
  let body: unknown;
  try {body=await request.json();}catch{return NextResponse.json({message:"Invalid request"},{status:400});}
  if(!body || typeof body!=="object" || Array.isArray(body))
    return NextResponse.json({message:"Invalid request"},{status:400});
  try {
    const result=await fetch(new URL("/api/identity/login",backend),{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,deviceLabel:"Foundation Admin Web"}),
      cache:"no-store",signal:AbortSignal.timeout(10000)
    });
    if(!result.ok){
      if(result.status===400){
        const data:unknown=await result.json().catch(()=>null);
        const obj=data&&typeof data==="object"&&!Array.isArray(data)?data as Record<string,unknown>:{};
        const codes=new Set(["IDENTITY_IDENTIFIER_REQUIRED","IDENTITY_IDENTIFIER_INVALID",
          "IDENTITY_PASSWORD_REQUIRED","IDENTITY_PASSWORD_TOO_LONG","IDENTITY_DEVICE_INVALID"]);
        const code=typeof obj.code==="string"&&codes.has(obj.code)?obj.code:null;
        const field=code&&["identifier","password"].includes(String(obj.field))?obj.field:null;
        const message=code&&typeof obj.message==="string"&&obj.message.length<=220?
          obj.message:"Check the mobile number/email and password fields before signing in.";
        return NextResponse.json({message,...(code?{code}:{}),...(field?{field}:{})},
          {status:400,headers:{"Cache-Control":"no-store"}});
      }
      if(result.status===401){
        // Identity failures share one generic server-owned, Admin-editable message.
        // Never reveal whether the identifier exists or the account is inactive.
        const raw:unknown=await result.json().catch(()=>null);
        const payload=raw&&typeof raw==="object"&&!Array.isArray(raw)?
          raw as Record<string,unknown>:{};
        const isSafe=payload.code==="IDENTITY_LOGIN_INVALID"&&
          typeof payload.message==="string"&&payload.message.length>=16&&
          payload.message.length<=220;
        return NextResponse.json({
          message:isSafe?payload.message:"Mobile number/email or password could not be confirmed.",
          ...(isSafe?{code:"IDENTITY_LOGIN_INVALID"}:{})
        },{status:401,headers:{"Cache-Control":"no-store"}});
      }
      return NextResponse.json({message:
        result.status===401?"Mobile number/email or password is incorrect.":
        result.status===429?"Too many login attempts. Please try again later.":
        "Sign-in cannot be confirmed right now. Check the connection and retry."},
        {status:result.status===429?429:result.status===401?401:503,
         headers:{"Cache-Control":"no-store"}});
    }
    const data:unknown=await result.json();
    if(!data || typeof data!=="object" || !("sessionToken" in data) || typeof data.sessionToken!=="string"
      || !("expiresAt" in data) || typeof data.expiresAt!=="string")
      return NextResponse.json({message:"Sign-in status could not be confirmed"},{status:503});
    const expiry=new Date(data.expiresAt);
    if(!Number.isFinite(expiry.getTime()) || expiry.getTime()<=Date.now())
      return NextResponse.json({message:"Sign-in status could not be confirmed"},{status:503});
    const response=NextResponse.json({signedIn:true});
    const rememberMe="rememberMe" in body && body.rememberMe===true;
    response.cookies.set("cg_staff_session",data.sessionToken,{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",expires:rememberMe?expiry:undefined
    });
    response.headers.set("Cache-Control","no-store");
    return response;
  } catch { return NextResponse.json({message:"Sign-in unavailable"},{status:503}); }
}
