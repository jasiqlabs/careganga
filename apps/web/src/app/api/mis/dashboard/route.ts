import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Staff-cookie BFF; never pass browser-supplied bearer tokens to private MIS. */
export async function GET(request:NextRequest){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Sign in to view Foundation reports."},
  {status:401,headers:{"Cache-Control":"private, no-store"}});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Reporting is temporarily unavailable."},
  {status:503,headers:{"Cache-Control":"private, no-store"}});
 const target=new URL("/api/v1/mis/dashboard",backend);
 for(const [key,value] of request.nextUrl.searchParams){
  if(!["yearRef","branchRef"].includes(key)||!ID.test(value))
   return NextResponse.json({message:"Select a valid permitted report filter."},
    {status:400,headers:{"Cache-Control":"private, no-store"}});
  target.searchParams.set(key,value);
 }
 try{
  const response=await fetch(target,{cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token}});
  if(!response.ok){
   const status=[400,401,403,429].includes(response.status)?response.status:503;
   return NextResponse.json({message:status===401?"Your session expired. Sign in again.":
    status===403?"Your role cannot access Foundation reporting.":
    status===400?"Check the permitted report filters.":"Reporting data could not be verified."},
    {status,headers:{"Cache-Control":"private, no-store"}});
  }
  return NextResponse.json(await response.json(),{headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return NextResponse.json({message:"Reporting data could not be verified. Try again."},
   {status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
