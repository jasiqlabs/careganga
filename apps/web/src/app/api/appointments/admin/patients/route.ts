import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
export async function GET(request:NextRequest){
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Sign in as a permitted Foundation administrator."},
  {status:401,headers:{"Cache-Control":"private, no-store"}});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Patient management is unavailable."},
  {status:503,headers:{"Cache-Control":"private, no-store"}});
 const allowed=new URLSearchParams();
 for(const key of ["centerRef","status","after","limit","day","stateRef","districtRef","centerType"]){
  const value=request.nextUrl.searchParams.get(key);
  if(value!==null)allowed.set(key,value.slice(0,50));
 }
 if([...request.nextUrl.searchParams.keys()].some(key=>
  !["centerRef","status","after","limit","day","stateRef","districtRef","centerType"].includes(key)))
  return NextResponse.json({message:"Invalid patient filter."},{status:400});
 try{
  const response=await fetch(new URL("/api/v1/appointments/admin/patients?"+
   allowed.toString(),backend),{
   cache:"no-store",signal:AbortSignal.timeout(10000),
   headers:{Authorization:"Bearer "+token}});
  if(!response.ok){
   const status=[400,401,403].includes(response.status)?response.status:503;
   return NextResponse.json({message:status===403?
    "Your current Foundation role cannot view patient management.":
    status===401?"Your account session expired. Sign in again.":
    status===400?"Review the patient filter choices.":
    "Current patient records could not be confirmed."},
    {status,headers:{"Cache-Control":"private, no-store"}});
  }
  return NextResponse.json(await response.json() as unknown,{
   headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return NextResponse.json({message:"Current patient records are temporarily unavailable."},
   {status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
