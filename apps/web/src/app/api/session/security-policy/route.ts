import { cookies } from "next/headers";
import { NextRequest,NextResponse } from "next/server";
export const dynamic="force-dynamic";

async function proxy(request:NextRequest,method:"GET"|"PATCH"){
  if(method==="PATCH"&&request.headers.get("origin")!==request.nextUrl.origin)
    return NextResponse.json({message:"Retry this action from CareGanga."},{status:403});
  const token=(await cookies()).get("cg_staff_session")?.value;
  if(!token)return NextResponse.json({message:"Your staff session has expired."},{status:401});
  const backend=process.env.BACKEND_URL;
  if(!backend)return NextResponse.json({message:"Security policy unavailable."},{status:503});
  let body:string|undefined;
  if(method==="PATCH"){
    try{
      const input:unknown=await request.json();
      if(!input||typeof input!=="object"||Array.isArray(input))throw Error("invalid");
      body=JSON.stringify(input);
      if(body.length>3000)throw Error("too large");
    }catch{return NextResponse.json({message:"Check the entered policy values."},{status:400});}
  }
  try{
    const response=await fetch(new URL("/api/identity/security-policy",backend),{
      method,headers:{Authorization:"Bearer "+token,...(body?{"Content-Type":"application/json"}:{})},
      body,cache:"no-store",signal:AbortSignal.timeout(12000)
    });
    if(!response.ok){
      const status=[400,401,403,409,429].includes(response.status)?response.status:503;
      let code:string|undefined;
      if(status===409){
        try{
          const error:unknown=await response.json();
          if(error&&typeof error==="object"&&"code" in error&&
            (error.code==="POLICY_STALE"||error.code==="POLICY_REPLAY_CONFLICT"))
            code=error.code;
        }catch{/* server internals must not leak */}
      }
      return NextResponse.json({message:
        status===401?"Your session expired. Sign in again.":
        status===403?"This action is restricted to the Foundation Super Admin.":
        status===409?"The policy changed elsewhere. Refresh before saving.":
        status===429?"Too many attempts. Try again later.":
        status===400?"Check permitted policy limits and enter a fresh authenticator code.":
        "The change outcome could not be confirmed. Check before retrying.",
        ...(code?{code}:{})},{status,headers:{"Cache-Control":"no-store"}});
    }
    const data:unknown=await response.json();
    return NextResponse.json(data,{status:response.status,headers:{"Cache-Control":"no-store"}});
  }catch{
    return NextResponse.json({message:"The outcome cannot be confirmed. Refresh before retrying."},
      {status:503,headers:{"Cache-Control":"no-store"}});
  }
}
export async function GET(request:NextRequest){return proxy(request,"GET");}
export async function PATCH(request:NextRequest){return proxy(request,"PATCH");}
