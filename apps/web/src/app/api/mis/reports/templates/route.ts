import {cookies} from "next/headers";
import {NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(){
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return NextResponse.json({message:"Sign in to view reports."},{
  status:401,headers:{"Cache-Control":"private, no-store"}});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Report choices are unavailable."},{
  status:503,headers:{"Cache-Control":"private, no-store"}});
 try{
  const res=await fetch(new URL("/api/v1/mis/reports/templates",backend),{
   cache:"no-store",signal:AbortSignal.timeout(11000),
   headers:{Authorization:"Bearer "+session}});
  if(!res.ok)return NextResponse.json({
   message:res.status===403?"Your role cannot use these reports.":
    "Report choices could not be verified."},{
   status:[401,403].includes(res.status)?res.status:503,
   headers:{"Cache-Control":"private, no-store"}});
  return NextResponse.json(await res.json(),{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({message:"Report choices are unavailable. Try again."},{
  status:503,headers:{"Cache-Control":"private, no-store"}});}
}
