import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{reviewRef:string}>};
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const error=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
export async function GET(req:NextRequest,{params}:Context){
 const {reviewRef}=await params;
 if(!ID.test(reviewRef)||req.nextUrl.searchParams.size)
  return error(400,"Choose an original pending identity review.");
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return error(401,"Sign in to an authorized Foundation account.");
 if(!process.env.BACKEND_URL)return error(503,"Identity evidence source is unavailable.");
 try{
  const url=new URL("/api/v1/appointments/admin/patients/duplicate-reviews/"+
   encodeURIComponent(reviewRef)+"/evidence",process.env.BACKEND_URL);
  const res=await fetch(url,{cache:"no-store",signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+token}});
  if(!res.ok){
   const status=[400,401,403,404,409].includes(res.status)?res.status:503;
   return error(status,status===409?
    "This review changed or needs a different independent reviewer.":
    status===403?"Your current role cannot inspect these source identity records.":
    "The original identity evidence is unavailable.");
  }
  return NextResponse.json(await res.json() as unknown,{
   headers:{"Cache-Control":"private, no-store"}});
 }catch{return error(503,"The original identity evidence could not be confirmed.");}
}
