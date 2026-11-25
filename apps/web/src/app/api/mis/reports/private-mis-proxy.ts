import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import {safeMisBffError} from "./safe-mis-bff-error";
import {isAllowedOrigin} from "../../../../shared/request-origin";
const noStore={"Cache-Control":"private, no-store"};
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const validMisRef=(v:string)=>ID.test(v);
/** Single private staff-cookie hop: no browser-selected backend URL or token,
 * no raw provider/SQL errors and same-origin writes only.
 */
export async function privateMisProxy(request:NextRequest,path:string,
 method:"GET"|"POST"|"PATCH"){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Sign in to manage reports."},
  {status:401,headers:noStore});
 if(method!=="GET"){
  if(!isAllowedOrigin(request))
   return NextResponse.json({message:"Open this report from the secure staff dashboard."},
    {status:403,headers:noStore});
  if(request.headers.get("sec-fetch-site")==="cross-site")
   return NextResponse.json({message:"This report request is not permitted."},
    {status:403,headers:noStore});
 }
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Reports are currently unavailable."},
  {status:503,headers:noStore});
 try{
  const body=method==="GET"?undefined:await request.text();
  if(body&&body.length>5000)return NextResponse.json({message:"Use fewer report options."},
   {status:413,headers:noStore});
  const url=new URL("/api/v1/mis/reports/"+path,backend);
  const res=await fetch(url,{method,cache:"no-store",signal:AbortSignal.timeout(12500),
   headers:{Authorization:"Bearer "+token,...(body!==undefined?
    {"Content-Type":"application/json"}:{})},body});
  if(!res.ok){
   const fallback=res.status===401?"Sign in again to manage reports.":
   res.status===403?"Your role or source access no longer allows this action.":
   res.status===404?"This saved report is no longer available.":
   res.status===409?"This report has changed. Refresh it before editing.":
   res.status===400?"Choose a valid report name, source and filters.":
   "The report outcome could not be confirmed. Refresh its current status.";
   return NextResponse.json({message:await safeMisBffError(res,fallback)},{
    status:[400,401,403,404,409,413,429].includes(res.status)?res.status:503,
    headers:noStore});
  }
  return NextResponse.json(await res.json(),{headers:noStore});
 }catch{
  return NextResponse.json({message:"Could not confirm this report request. Refresh before retrying."},
   {status:503,headers:noStore});
 }
}
