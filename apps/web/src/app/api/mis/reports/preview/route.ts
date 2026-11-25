import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import {safeMisBffError} from "../safe-mis-bff-error";
import {isAllowedOrigin} from "../../../../../shared/request-origin";
export const dynamic="force-dynamic";
export async function POST(request:NextRequest){
 if(!isAllowedOrigin(request)||request.headers.get("sec-fetch-site")==="cross-site")
  return NextResponse.json({message:"Open this report from the secure staff dashboard."},{
   status:403,headers:{"Cache-Control":"private, no-store"}});
 const session=(await cookies()).get("cg_staff_session")?.value;
 if(!session)return NextResponse.json({message:"Sign in to run reports."},{
  status:401,headers:{"Cache-Control":"private, no-store"}});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Reporting is unavailable."},{
  status:503,headers:{"Cache-Control":"private, no-store"}});
 try{
  const raw=await request.text();
  if(raw.length>4000) return NextResponse.json({message:"Choose fewer report filters."},{
   status:413,headers:{"Cache-Control":"private, no-store"}});
  const body:unknown=JSON.parse(raw);
  const res=await fetch(new URL("/api/v1/mis/reports/preview",backend),{
   method:"POST",cache:"no-store",signal:AbortSignal.timeout(13000),
   headers:{Authorization:"Bearer "+session,"Content-Type":"application/json"},
   body:JSON.stringify(body)});
  if(!res.ok){
   const fallback=res.status===403?"Your role or location cannot access this source.":
    res.status===400?"Review the selected report filters and view.":
    res.status===404?"This report source is not available.":
    "This report could not be verified. Please retry.";
   return NextResponse.json({message:await safeMisBffError(res,fallback)},{
    status:[400,401,403,404,409,413,429].includes(res.status)?res.status:503,
    headers:{"Cache-Control":"private, no-store"}});
  }
  return NextResponse.json(await res.json(),{headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({message:"Could not confirm the report. Please retry."},{
  status:503,headers:{"Cache-Control":"private, no-store"}});}
}
