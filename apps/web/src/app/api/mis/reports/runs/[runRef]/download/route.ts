import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
import {validMisRef} from "../../../private-mis-proxy";
export const dynamic="force-dynamic";
const safe={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const MIMES={
 "application/pdf":"pdf",
 "text/csv":"csv",
 "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":"xlsx"
};
export async function GET(req:NextRequest,{params}:{params:Promise<{runRef:string}>}){
 const {runRef}=await params;
 if(!validMisRef(runRef))return NextResponse.json({message:"Report unavailable."},{
  status:404,headers:safe});
 const token=(await cookies()).get("cg_staff_session")?.value;
 const backend=process.env.BACKEND_URL;
 if(!token)return NextResponse.json({message:"Sign in again for this report."},{
  status:401,headers:safe});
 if(!backend)return NextResponse.json({message:"Protected file service unavailable."},{
  status:503,headers:safe});
 try{
  const res=await fetch(new URL("/api/v1/mis/reports/runs/"+
   encodeURIComponent(runRef)+"/download",backend),{
   cache:"no-store",signal:AbortSignal.timeout(18000),
   headers:{Authorization:"Bearer "+token}});
  if(!res.ok)return NextResponse.json({message:
   res.status===403?"Your source access has changed. The file is not available.":
   "This private report is no longer available."},{
   status:[401,403,404,409].includes(res.status)?res.status:503,headers:safe});
  const mime=res.headers.get("content-type")?.split(";")[0]??"";
  const suffix=MIMES[mime as keyof typeof MIMES];
  const length=Number(res.headers.get("content-length")??0);
  if(!suffix||length>5242880)return NextResponse.json({
   message:"The original report format could not be confirmed."},{
   status:503,headers:safe});
  const bytes=await res.arrayBuffer();
  if(bytes.byteLength>5242880)return NextResponse.json({
   message:"The original report exceeds the safe download limit."},{
   status:503,headers:safe});
  return new NextResponse(bytes,{headers:{...safe,"Content-Type":mime,
   "Content-Disposition":'attachment; filename="CareGanga-Report.'+suffix+'"'}});
 }catch{return NextResponse.json({message:"Report download cannot be confirmed."},{
  status:503,headers:safe});}
}
