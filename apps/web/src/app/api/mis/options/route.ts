import {cookies} from "next/headers";
import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(){
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return NextResponse.json({message:"Sign in to see available report filters."},
  {status:401,headers:{"Cache-Control":"private, no-store"}});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Report filters unavailable."},
  {status:503,headers:{"Cache-Control":"private, no-store"}});
 try{
  const response=await fetch(new URL("/api/v1/mis/options",backend),{
   cache:"no-store",signal:AbortSignal.timeout(10000),
   headers:{Authorization:"Bearer "+session}});
  if(!response.ok)return NextResponse.json({message:
   response.status===403?"Your role cannot view reporting options.":
   "Report filters could not be verified."},{
    status:[401,403].includes(response.status)?response.status:503,
    headers:{"Cache-Control":"private, no-store"}});
  return NextResponse.json(await response.json(),{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({message:"Report filters unavailable. Refresh and try again."},
  {status:503,headers:{"Cache-Control":"private, no-store"}});}
}
