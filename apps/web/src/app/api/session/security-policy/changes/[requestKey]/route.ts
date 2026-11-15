import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export async function GET(_request:NextRequest,context:{
  params:Promise<{requestKey:string}>
}){
  const key=(await context.params).requestKey;
  if(!UUID.test(key))return NextResponse.json({message:"Invalid request"},{status:400});
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return NextResponse.json({message:"Sign in again."},{status:401});
  const backend=process.env.BACKEND_URL;
  if(!backend)return NextResponse.json({message:"Status unavailable"},{status:503});
  try{
    const result=await fetch(new URL("/api/identity/security-policy/changes/"+key,backend),{
      method:"GET",headers:{Authorization:"Bearer "+token},cache:"no-store",
      signal:AbortSignal.timeout(10000)
    });
    if(!result.ok){
      const status=result.status===401?401:result.status===403?403:503;
      return NextResponse.json({message:status===401?"Session expired":
        status===403?"Access denied":"Status unavailable"},{status});
    }
    const value:unknown=await result.json();
    if(!value||typeof value!=="object"||!("status" in value)||
      (value.status!=="CONFIRMED"&&value.status!=="NOT_FOUND"))
      throw Error("Unverified status");
    return NextResponse.json(value,{headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({message:"Status cannot be confirmed"},{status:503});
  }
}
