import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{parts:string[]}>};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const reply=(status:number,message:string)=>NextResponse.json(
  {message},{status,headers:{"Cache-Control":"no-store"}}
);
function activeBranchEvidence(parts:string[],method:"GET"|"POST"){
  if(parts[0]!=="active-branch-files")return false;
  if(parts.length===2&&parts[1]==="intents")return method==="POST";
  if(parts.length===3&&parts[1]==="intents"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===4&&parts[1]==="intents"&&UUID.test(parts[2])&&parts[3]==="confirm")
    return method==="POST";
  if(parts.length===3&&parts[1]==="branches"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===4&&parts[1]==="files"&&UUID.test(parts[2])&&
    ["revoke","download"].includes(parts[3]))return method===(
      parts[3]==="revoke"?"POST":"GET");
  return false;
}
function branchEvidence(parts:string[],method:"GET"|"POST"){
  if(parts[0]!=="branch-evidence")return false;
  if(parts.length===2&&parts[1]==="intents")return method==="POST";
  if(parts.length===3&&parts[1]==="intents"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===4&&parts[1]==="intents"&&UUID.test(parts[2])&&
     parts[3]==="confirm")return method==="POST";
  if(parts.length===3&&parts[1]==="registration"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===4&&parts[1]==="files"&&UUID.test(parts[2])&&
     parts[3]==="revoke")return method==="POST";
  if(parts.length===4&&parts[1]==="files"&&UUID.test(parts[2])&&
     parts[3]==="download")return method==="GET";
  return false;
}
function allowed(parts:string[],method:"GET"|"POST"){
  if(parts[0]==="branch-evidence")return branchEvidence(parts,method);
  if(parts[0]==="active-branch-files")return activeBranchEvidence(parts,method);
  if(parts.length===2&&parts[0]==="letters"&&parts[1]==="template")
    return method==="GET";
  if(parts.length===3&&parts[0]==="letters"&&parts[1]==="template"&&
    parts[2]==="approve")return method==="POST";
  if(parts.length===3&&parts[0]==="letters"&&parts[1]==="case"&&
    UUID.test(parts[2]))return method==="GET";
  if(parts.length===3&&parts[0]==="letters"&&parts[1]==="requests"&&
    UUID.test(parts[2]))return method==="GET";
  if(parts.length===2&&parts[0]==="letters"&&parts[1]==="issue")
    return method==="POST";
  if(parts.length===3&&parts[0]==="letters"&&UUID.test(parts[1])&&
    parts[2]==="download")return method==="GET";
  if(parts.length===3&&parts[0]==="letters"&&UUID.test(parts[1])&&
    ["reconcile","revoke"].includes(parts[2]))return method==="POST";
  if(parts.length===2&&parts[0]==="files"&&parts[1]==="initiate")
    return method==="POST";
  if(parts.length===3&&parts[0]==="files"&&
    parts[1]==="case"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===3&&parts[0]==="files"&&UUID.test(parts[1])&&
    parts[2]==="revoke")return method==="POST";
  if(parts.length===3&&parts[0]==="files"&&
    parts[1]==="intents"&&UUID.test(parts[2]))return method==="GET";
  if(parts.length===4&&parts[0]==="files"&&
    parts[1]==="intents"&&UUID.test(parts[2])&&parts[3]==="confirm")
    return method==="POST";
  if(parts.length===3&&parts[0]==="files"&&
    UUID.test(parts[1])&&parts[2]==="download")return method==="GET";
  return false;
}
async function proxy(request:NextRequest,parts:string[],method:"GET"|"POST"){
  if(!allowed(parts,method))return reply(404,"This document action is unavailable.");
  if(method==="POST"&&request.headers.get("origin")!==request.nextUrl.origin)
    return reply(403,"Submit the file request from CareGanga.");
  const session=(await cookies()).get("cg_staff_session")?.value;
  if(!session)return reply(401,"Sign in to access private files.");
  if(!process.env.BACKEND_URL)
    return reply(503,"The protected documents service is unavailable.");
  let body:string|undefined;
  if(method==="POST"&&
    ((parts[0]==="active-branch-files"&&((parts.length===2&&parts[1]==="intents")||
      (parts.length===4&&parts[1]==="files"&&parts[3]==="revoke")))||
    ((parts[0]==="branch-evidence"&&((parts.length===2&&parts[1]==="intents")||
      (parts.length===4&&parts[1]==="files"&&parts[3]==="revoke")))||
      (parts.length===2&&["initiate","issue"].includes(parts[1]))||
      (parts.length===3&&parts[1]==="template"&&parts[2]==="approve")||
      (parts.length===3&&["letters","files"].includes(parts[0])&&
        parts[2]==="revoke"))){
    try{
      const input:unknown=await request.json();
      if(!input||typeof input!=="object"||Array.isArray(input))throw Error();
      body=JSON.stringify(input);
      if(body.length>1500)throw Error();
    }catch{return reply(400,"Check the file details.");}
  }
  const download=(parts.length===3&&
    (parts[0]==="files"||parts[0]==="letters")&&parts[2]==="download")||
    (parts.length===4&&["branch-evidence","active-branch-files"].includes(parts[0])&&
      parts[1]==="files"&&parts[3]==="download");
  try{
    const path="/api/documents/"+parts.join("/");
    const target=new URL(path,process.env.BACKEND_URL);
    const response=await fetch(target,{
      method,cache:"no-store",signal:AbortSignal.timeout(12000),body,
      headers:{Authorization:"Bearer "+session,
        ...(body?{"Content-Type":"application/json"}:{})}
    });
    if(!response.ok){
      const status=[400,401,403,404,409,429].includes(response.status)?
        response.status:503;
      return reply(status,status===401?"Your session expired. Sign in again.":
        status===403?"You cannot access this private file.":
        status===404?"The private file was not found.":
        status===409?"The file or application changed. Refresh before continuing.":
        status===429?"Too many attempts. Try again later.":
        status===400?"The file details are invalid.":
        "Secure file storage cannot currently be verified.");
    }
    if(download){
      const mime=response.headers.get("content-type")??"application/octet-stream";
      if(parts[0]==="letters"&&mime!=="application/pdf")
        return reply(503,"The private letter format cannot be verified.");
      if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))
        return reply(503,"The private file format cannot be verified.");
      const bytes=response.headers.get("content-length");
      if(bytes&&(!/^\d+$/.test(bytes)||Number(bytes)>10*1024*1024))
        return reply(503,"The private file is too large.");
      return new NextResponse(response.body,{
        status:200,headers:{"Content-Type":mime,"Cache-Control":"private, no-store",
          "Content-Disposition":parts[0]==="letters"?
            'attachment; filename="Private-access-confirmation.pdf"':
            'attachment; filename="Private-case-evidence"',
          "X-Content-Type-Options":"nosniff"}
      });
    }
    const result:unknown=await response.json();
    return NextResponse.json(result,{headers:{"Cache-Control":"no-store"}});
  }catch{return reply(503,"The request result is uncertain. Check its original status.");}
}
export async function GET(request:NextRequest,context:Context){
  return proxy(request,(await context.params).parts,"GET");
}
export async function POST(request:NextRequest,context:Context){
  return proxy(request,(await context.params).parts,"POST");
}
