import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Context={params:Promise<{reviewRef:string}>};
const BAD=(status:number,message:string)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"private, no-store"}});
export async function POST(req:NextRequest,{params}:Context){
 const {reviewRef}=await params;
 if(!ID.test(reviewRef)||req.headers.get("origin")!==req.nextUrl.origin)
  return BAD(403,"Open this restricted review from your current Foundation screen.");
 const bearer=(await cookies()).get("cg_staff_session")?.value;
 if(!bearer)return BAD(401,"Sign in to the authorized Foundation account.");
 const backend=process.env.BACKEND_URL;
 if(!backend)return BAD(503,"Patient review is temporarily unavailable.");
 let body:string;
 try{
  const raw:unknown=await req.json();
  if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("invalid");
  const v=raw as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["decision","expectedVersion","currentPassword",
   "samePersonEvidenceReviewed"].includes(k))||
   !["APPROVE","REJECT"].includes(String(v.decision))||
   v.expectedVersion!==1||typeof v.currentPassword!=="string"||
   v.currentPassword.length<8||v.currentPassword.length>1024)
   throw Error("invalid");
  body=JSON.stringify(v);
 }catch{return BAD(400,"Confirm the decision and your current password.");}
 try{
  const url=new URL("/api/v1/appointments/admin/patients/duplicate-reviews/"+
   encodeURIComponent(reviewRef)+"/decision",backend);
  const res=await fetch(url,{method:"POST",body,cache:"no-store",
   signal:AbortSignal.timeout(12000),
   headers:{Authorization:"Bearer "+bearer,"Content-Type":"application/json"}});
  if(!res.ok){
   const status=[400,401,403,404,409,429].includes(res.status)?res.status:503;
   return BAD(status,status===409?"The original review changed or requires a different reviewer.":
    status===403?"A protected, independent Foundation reviewer and password are required.":
    status===429?"Too many password attempts. Try later.":
    "The original duplicate review decision is not confirmed.");
  }
  return NextResponse.json(await res.json() as unknown,{
   headers:{"Cache-Control":"private, no-store"}});
 }catch{return BAD(503,"The review decision may have been saved. Check the current inbox.");}
}
