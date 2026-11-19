import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context={params:Promise<{bookingRef:string}>};
export async function GET(req:NextRequest,{params}:Context){
 const {bookingRef}=await params;
 if(!ID.test(bookingRef))return NextResponse.json({message:"Invalid booking."},{status:400});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Sign in to your authorized Foundation account."},
  {status:401,headers:{"Cache-Control":"no-store"}});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Protected history is unavailable."},
  {status:503,headers:{"Cache-Control":"no-store"}});
 const before=req.nextUrl.searchParams.get("before");
 if([...req.nextUrl.searchParams.keys()].some(k=>k!=="before")||
  before!==null&&!/^\d{1,9}$/.test(before))
  return NextResponse.json({message:"Check the history page reference."},{status:400});
 try{
  const path="/api/v1/appointments/admin/patients/"+
   encodeURIComponent(bookingRef)+"/history"+(before?"?before="+before:"");
  const r=await fetch(new URL(path,backend),{
   cache:"no-store",signal:AbortSignal.timeout(10000),
   headers:{Authorization:"Bearer "+token}});
  if(!r.ok){
   const status=[400,401,403,404].includes(r.status)?r.status:503;
   return NextResponse.json({message:status===403?
    "Your role cannot view this booking history.":
    status===401?"Your account session expired. Sign in again.":
    status===404?"That booking history was not found.":
    "The original history could not be confirmed."},
    {status,headers:{"Cache-Control":"private, no-store"}});
  }
  return NextResponse.json(await r.json() as unknown,
   {headers:{"Cache-Control":"private, no-store"}});
 }catch{return NextResponse.json({message:"Booking history is unavailable. Try again."},
   {status:503,headers:{"Cache-Control":"private, no-store"}});}
}
