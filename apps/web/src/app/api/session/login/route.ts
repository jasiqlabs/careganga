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
    if(!result.ok) return NextResponse.json({message:"Unable to sign in"},{status:result.status===429?429:result.status===401?401:503});
    const data:unknown=await result.json();
    if(!data || typeof data!=="object" || !("sessionToken" in data) || typeof data.sessionToken!=="string"
      || !("expiresAt" in data) || typeof data.expiresAt!=="string")
      return NextResponse.json({message:"Sign-in status could not be confirmed"},{status:503});
    const expiry=new Date(data.expiresAt);
    if(!Number.isFinite(expiry.getTime()) || expiry.getTime()<=Date.now())
      return NextResponse.json({message:"Sign-in status could not be confirmed"},{status:503});
    const response=NextResponse.json({signedIn:true});
    response.cookies.set("cg_staff_session",data.sessionToken,{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"strict",path:"/",expires:expiry
    });
    response.headers.set("Cache-Control","no-store");
    return response;
  } catch { return NextResponse.json({message:"Sign-in unavailable"},{status:503}); }
}
