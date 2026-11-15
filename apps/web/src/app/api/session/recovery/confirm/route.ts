import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest) {
  const origin=request.headers.get("origin");
  if(!origin||origin!==request.nextUrl.origin)
    return NextResponse.json({message:"Request could not be completed"},{status:403});
  const backend=process.env.BACKEND_URL;
  if(!backend)return NextResponse.json({message:"Account recovery unavailable"},{status:503});
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({message:"Check the information entered."},{status:400});}
  if(!body||typeof body!=="object"||Array.isArray(body))
    return NextResponse.json({message:"Check the information entered."},{status:400});
  try{
    const result=await fetch(new URL("/api/identity/recovery/confirm",backend),{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(body),cache:"no-store",signal:AbortSignal.timeout(10000)
    });
    if(!result.ok)
      return NextResponse.json({message:result.status===429?"Too many attempts. Try later.":result.status===400?"Details could not be confirmed.":"Recovery unavailable."},
        {status:result.status===429?429:result.status===400?400:503});
    const response=NextResponse.json({message:"Password updated. Return to sign in."},{status:200});
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch{
    return NextResponse.json({message:"The request outcome could not be confirmed. Check before trying again."},{status:503});
  }
}
