import { cookies } from "next/headers";
import { NextRequest,NextResponse } from "next/server";
import { isAllowedOrigin } from "../../../../shared/request-origin";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest) {
  if (!isAllowedOrigin(request))
    return NextResponse.json({signedOut:false},{status:403});
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token) return NextResponse.json({signedOut:true});
  const backend=process.env.BACKEND_URL;
  if(!backend) return NextResponse.json({signedOut:false},{status:503});
  try {
    const result=await fetch(new URL("/api/identity/logout",backend),{
      method:"POST",headers:{Authorization:"Bearer "+token},cache:"no-store",signal:AbortSignal.timeout(10000)
    });
    if (!result.ok) return NextResponse.json({signedOut:false},{status:503});
    const response=NextResponse.json({signedOut:true});
    response.cookies.delete("cg_staff_session");
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch{return NextResponse.json({signedOut:false},{status:503});}
}
