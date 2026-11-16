import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions=new Set(["PROFILE_SAVE","AREA_CREATE","AREA_UPDATE","DEPARTMENT_CREATE",
  "DEPARTMENT_UPDATE","PARTICIPANT_ADD","PARTICIPANT_END"]);
function allowed(parts:string[],method:string){
  if(parts[0]==="operating-branches"){
    if(parts.length===1)return method==="GET";
    if(parts.length<2||!UUID.test(parts[1]))return false;
    if(parts.length===2)return method==="GET"||method==="PATCH";
    if(parts.length===3&&["status"].includes(parts[2]))return method==="PATCH";
    if(parts.length===3&&["revisions","departments","department-links"].includes(parts[2]))
      return method==="GET"||(method==="POST"&&parts[2]!=="revisions");
    if(parts.length===4&&parts[2]==="departments"&&UUID.test(parts[3]))
      return method==="PATCH";
    if(parts.length===5&&parts[2]==="department-links"&&UUID.test(parts[3])&&
      parts[4]==="end")return method==="POST";
    if(parts.length===5&&parts[2]==="departments"&&UUID.test(parts[3])&&
      parts[4]==="participants")return method==="GET"||method==="POST";
    if(parts.length===7&&parts[2]==="departments"&&UUID.test(parts[3])&&
      parts[4]==="participants"&&UUID.test(parts[5])&&parts[6]==="end")return method==="POST";
    return false;
  }
  if(parts[0]==="branch-workflow"){
    if(parts.length===4&&parts[1]==="operating-branches"&&UUID.test(parts[2])&&
      parts[3]==="update")return method==="POST";
    if(parts.length===2&&parts[1]==="cases")return method==="GET";
    if(parts.length===3&&parts[1]==="cases"&&UUID.test(parts[2]))return method==="GET";
    if(parts.length===4&&parts[1]==="cases"&&UUID.test(parts[2])&&
       ["decide","finalize","reconcile"].includes(parts[3]))return method==="POST";
    if(parts.length===4&&parts[1]==="registrations"&&UUID.test(parts[2])&&
       parts[3]==="submit")return method==="POST";
    if(parts.length===4&&parts[1]==="registrations"&&UUID.test(parts[2])&&
       parts[3]==="status")return method==="GET";
    return false;
  }
  if(parts[0]==="branches"){
    if(parts.length===3&&parts[1]==="managers"&&parts[2]==="options")return method==="GET";
    if(parts.length===2&&parts[1]==="department-options")return method==="GET";
    if(parts.length===2&&parts[1]==="drafts")return method==="GET"||method==="POST";
    if(parts.length===3&&parts[1]==="drafts"&&UUID.test(parts[2]))return method==="GET"||method==="PATCH";
    if(parts.length===4&&parts[1]==="changes"&&
       ["BRANCH_DRAFT_CREATE","BRANCH_DRAFT_SAVE"].includes(parts[2])&&UUID.test(parts[3]))return method==="GET";
    return false;
  }
  if(parts.length===1){
    if(parts[0]==="profile")return method==="GET"||method==="PATCH";
    if(parts[0]==="geography"||parts[0]==="departments")return method==="GET"||method==="POST";
  }
  if(parts.length===2&&parts[0]==="export")return false;
  if(parts.length===1&&parts[0]==="export")return method==="GET";
  if(parts.length===3&&parts[0]==="history"&&
    ["PROFILE","AREA","DEPARTMENT","PARTICIPANT"].includes(parts[1])&&
    (UUID.test(parts[2])||(parts[1]==="PROFILE"&&parts[2]==="self")) )
    return method==="GET";
  if(parts.length===2){
    if(parts[0]==="officeholders"&&parts[1]==="options")return method==="GET";
    if(parts[0]==="geography"&&UUID.test(parts[1]))return method==="PATCH";
    if(parts[0]==="departments"&&UUID.test(parts[1]))return method==="PATCH";
  }
  if(parts.length===3&&parts[0]==="departments"&&UUID.test(parts[1])&&parts[2]==="participants")
    return method==="GET"||method==="POST";
  if(parts.length===3&&parts[0]==="changes"&&actions.has(parts[1])&&UUID.test(parts[2]))
    return method==="GET";
  if(parts.length===5&&parts[0]==="departments"&&UUID.test(parts[1])&&
    parts[2]==="participants"&&UUID.test(parts[3])&&parts[4]==="end")return method==="POST";
  return false;
}
async function proxy(request:NextRequest,parts:string[],method:string){
  if(!allowed(parts,method))
    return NextResponse.json({message:"This Foundation action is unavailable."},{status:404});
  if(method!=="GET"&&request.headers.get("origin")!==request.nextUrl.origin)
    return NextResponse.json({message:"Please make this change from CareGanga."},{status:403});
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return NextResponse.json({message:"Please sign in."},{status:401});
  const backend=process.env.BACKEND_URL;
  if(!backend)return NextResponse.json({message:"Foundation service is temporarily unavailable."},{status:503});
  let body:string|undefined;
  if(method!=="GET"){
    try{
      const parsed:unknown=await request.json();
      if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Invalid form");
      body=JSON.stringify(parsed);
      if(body.length>12000)throw Error("Oversized form");
    }catch{return NextResponse.json({message:"Check the form before submitting."},{status:400});}
  }
  const target=new URL("/api/foundation-structure/"+parts.join("/"),backend);
  if(method==="GET")target.search=request.nextUrl.search;
  try{
    const response=await fetch(target,{
      method,cache:"no-store",signal:AbortSignal.timeout(12000),body,
      headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})}
    });
    if(!response.ok){
      const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
      const message=status===400?"Check the selected Foundation information."
        :status===401?"Your session has expired. Please sign in again."
        :status===403?"You are not permitted to view or change this information."
        :status===404?"This Foundation record is no longer available."
        :status===409?"The information changed elsewhere. Refresh before saving."
        :status===429?"Too many changes. Try again later."
        :"The result cannot be confirmed. Check the original request before retrying.";
      return NextResponse.json({message},{status,headers:{"Cache-Control":"no-store"}});
    }
    const data:unknown=await response.json();
    return NextResponse.json(data,{status:response.status,headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({message:"The result cannot be confirmed. Check before retrying."},
      {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
type Ctx={params:Promise<{parts:string[]}>};
export async function GET(req:NextRequest,ctx:Ctx){return proxy(req,(await ctx.params).parts,"GET");}
export async function POST(req:NextRequest,ctx:Ctx){return proxy(req,(await ctx.params).parts,"POST");}
export async function PATCH(req:NextRequest,ctx:Ctx){return proxy(req,(await ctx.params).parts,"PATCH");}
