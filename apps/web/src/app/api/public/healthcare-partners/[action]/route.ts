import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Ctx={params:Promise<{action:string}>};
const json=(message:string,status:number)=>NextResponse.json({message},{
 status,headers:{"Cache-Control":"no-store"}
});
/** Only public applicant intake/status; NEVER forward staff credentials or
 * an arbitrary backend path. Origin check stops CSRF through this website. */
export async function POST(req:NextRequest,ctx:Ctx){
 const {action}=await ctx.params;
 if(action!=="apply"&&action!=="status")return json("Unavailable",404);
 if(req.headers.get("origin")!==req.nextUrl.origin)
  return json("Submit the form from CareGanga.",403);
 if(!req.headers.get("content-type")?.startsWith("application/json"))
  return json("Check your application details.",415);
 const backend=process.env.BACKEND_URL;
 if(!backend)return json("Partner applications are temporarily unavailable.",503);
 let body:string;
 try{
  const data:unknown=await req.json();
  if(!data||typeof data!=="object"||Array.isArray(data))throw Error();
  body=JSON.stringify(data);
  if(body.length>(action==="apply"?4200:300))throw Error();
 }catch{return json("Check the form details before submitting.",400);}
 try{
  const url=new URL("/api/v1/public/health-network/partner-applications"+
   (action==="status"?"/status":""),backend);
  const response=await fetch(url,{method:"POST",body,cache:"no-store",
   headers:{"Content-Type":"application/json"},
   signal:AbortSignal.timeout(12000)});
  if(!response.ok){
   const status=[400,404,409,429].includes(response.status)?
    response.status:503;
   const message=status===429?"Too many attempts. Please try later.":
    status===409?"An earlier submission was changed. Refresh your original request.":
    status===404?"That private tracking code could not be verified.":
    status===400?"Please correct the application details.":
    "The result is uncertain. Check your status before resubmitting.";
   return json(message,status);
  }
  const payload:unknown=await response.json();
  if(!payload||typeof payload!=="object"||Array.isArray(payload)||
   !("reference" in payload)||typeof payload.reference!=="string"||
   !/^CGPA-[A-F0-9]{12}$/.test(payload.reference)||
   !("status" in payload)||typeof payload.status!=="string")
   return json("The application result could not be verified.",503);
  if(action==="apply"&&(!("receipt" in payload)||
   typeof payload.receipt!=="string"||
   !/^[a-zA-Z0-9_-]{43}$/.test(payload.receipt)))
   return json("The application result could not be verified.",503);
  return NextResponse.json(payload,{status:200,headers:{"Cache-Control":"no-store",
   "X-Content-Type-Options":"nosniff"}});
 }catch{return json("The result is uncertain. Check the original status before retrying.",503);}
}
