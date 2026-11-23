import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import { isAllowedOrigin } from "../../../../../shared/request-origin";

export const dynamic="force-dynamic";
export async function POST(request:NextRequest) {
  if(!isAllowedOrigin(request))
    return NextResponse.json({message:"Retry from CareGanga."},{status:403});
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return NextResponse.json({message:"Sign in again."},{status:401});
  const backend=process.env.BACKEND_URL;
  if(!backend)return NextResponse.json({message:"Password service unavailable."},{status:503});
  let input:unknown;
  try{input=await request.json();}catch{return NextResponse.json({message:"Check password details."},{status:400});}
  if(!input||typeof input!=="object"||Array.isArray(input))
    return NextResponse.json({message:"Check password details."},{status:400});
  const fields=input as Record<string,unknown>;
  if(Object.keys(fields).some(k=>!["currentPassword","newPassword"].includes(k))||
    typeof fields.currentPassword!=="string"||typeof fields.newPassword!=="string"||
    fields.currentPassword.length<1||fields.newPassword.length<8||
    fields.currentPassword.length>1024||fields.newPassword.length>1024)
    return NextResponse.json({message:"Check current and new password."},{status:400});
  try{
    const result=await fetch(new URL("/api/identity/password/change",backend),{
      method:"POST",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},
      body:JSON.stringify(fields),cache:"no-store",signal:AbortSignal.timeout(10000)
    });
    if(!result.ok)return NextResponse.json({message:
      result.status===401?"Sign in again.":result.status===403?"Current password could not be confirmed.":
      result.status===429?"Too many attempts. Try again later.":"Unable to confirm password change."},
      {status:[401,403,429].includes(result.status)?result.status:503});
    const response=NextResponse.json({changed:true,message:"Password changed. Sign in again."});
    response.cookies.set("cg_staff_session","",{path:"/",httpOnly:true,
      secure:process.env.NODE_ENV==="production",sameSite:"strict",maxAge:0});
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch{return NextResponse.json({message:"The change outcome is unknown. Try signing in with your new password first."},{status:503});}
}
