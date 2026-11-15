import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
export const dynamic="force-dynamic";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function allowed(parts:string[],method:string):boolean{
  if(parts.length===1){
    if(["effective","capabilities","audit"].includes(parts[0]))return method==="GET";
    if(parts[0]==="invitations")return method==="POST";
    if(parts[0]==="accounts")return method==="GET";
    return parts[0]==="roles"&&(method==="GET"||method==="POST");
  }
  if(parts.length===2){
    if(parts[0]==="accounts"||parts[0]==="roles"){
      if(parts[1]==="options")return method==="GET";
      return parts[0]==="roles"&&UUID.test(parts[1])&&method==="PATCH";
    }
    return false;
  }
  if(parts.length!==3||!UUID.test(parts[1]))return false;
  if(parts[0]==="accounts"){
    return (parts[2]==="role"&&(method==="PUT"||method==="DELETE"))||
      (parts[2]==="status"&&method==="PATCH");
  }
  return parts[0]==="roles"&&(parts[2]==="copy"||parts[2]==="retire")&&method==="POST";
}
async function proxy(request:NextRequest,parts:string[],method:string){
  if(!allowed(parts,method))return NextResponse.json({message:"This action is not available."},{status:404});
  const sameOrigin=request.headers.get("origin")===request.nextUrl.origin;
  if(method!=="GET"&&!sameOrigin)
    return NextResponse.json({message:"Please retry this action from CareGanga."},{status:403});
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return NextResponse.json({message:"Please sign in."},{status:401});
  const backend=process.env.BACKEND_URL;
  if(!backend)return NextResponse.json({message:"The service is temporarily unavailable."},{status:503});
  let body:string|undefined;
  if(method!=="GET"){
    try{
      const input:unknown=await request.json();
      if(!input||typeof input!=="object"||Array.isArray(input))throw new Error("body");
      body=JSON.stringify(input);
      if(body.length>12000)throw new Error("size");
    }catch{
      return NextResponse.json({message:"Please check the form and try again."},{status:400});
    }
  }
  const url=new URL("/api/access/"+parts.join("/"),backend);
  if(method==="GET")url.search=request.nextUrl.search;
  try{
    const response=await fetch(url,{
      method,headers:{
        Authorization:"Bearer "+token,
        ...(body?{"Content-Type":"application/json"}:{})
      },
      body,cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    if(!response.ok){
      let errorCode:string|undefined;
      if(response.status===409){
        try{
          const payload:unknown=await response.json();
          if(payload&&typeof payload==="object"&&"code" in payload&&
            typeof payload.code==="string"&&
            ["DUPLICATE_ROLE","STALE_ROLE","ROLE_RETIRED","ROLE_ASSIGNED","REPLAY_CONFLICT",
              "DUPLICATE_ACCOUNT_OR_ASSIGNMENT","STALE_ACCOUNT","ROLE_ALREADY_ASSIGNED",
              "ROLE_ALREADY_REVOKED","ACCOUNT_ALREADY_IN_STATUS"].includes(payload.code))
            errorCode=payload.code;
        }catch{ /* no unreviewed server content in the browser */ }
      }
      const status=[400,401,403,404,409,429].includes(response.status)?response.status:503;
      const message=status===401?"Your session has expired. Sign in again."
        :status===403?"You don't have permission for this action."
        :status===409?"This role was changed elsewhere. Refresh before saving."
        :status===429?"Too many attempts. Try again later."
        :status===404?"That role is no longer available."
        :status===400?"Check the entered information and try again."
        :"We could not confirm the result. Check before retrying.";
      return NextResponse.json({message,...(errorCode?{code:errorCode}:{})},
        {status,headers:{"Cache-Control":"no-store"}});
    }
    const data:unknown=await response.json();
    return NextResponse.json(data,{status:response.status,headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({message:"We could not confirm the result. Refresh before retrying."},
      {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
type Context={params:Promise<{parts:string[]}>};
export async function GET(request:NextRequest,ctx:Context){
  return proxy(request,(await ctx.params).parts,"GET");
}
export async function POST(request:NextRequest,ctx:Context){
  return proxy(request,(await ctx.params).parts,"POST");
}
export async function PATCH(request:NextRequest,ctx:Context){
  return proxy(request,(await ctx.params).parts,"PATCH");
}

export async function PUT(request:NextRequest,ctx:Context){return proxy(request,(await ctx.params).parts,"PUT");}
export async function DELETE(request:NextRequest,ctx:Context){return proxy(request,(await ctx.params).parts,"DELETE");}
