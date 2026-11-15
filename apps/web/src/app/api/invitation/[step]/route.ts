import { NextRequest,NextResponse } from "next/server";
export const dynamic="force-dynamic";
type Context={params:Promise<{step:string}>};
export async function POST(request:NextRequest,context:Context){
  const {step}=await context.params;
  if(step!=="enroll"&&step!=="confirm")
    return NextResponse.json({message:"Action unavailable"},{status:404});
  if(request.headers.get("origin")!==request.nextUrl.origin)
    return NextResponse.json({message:"Try from CareGanga"},{status:403});
  let input:unknown;
  try{input=await request.json();}catch{
    return NextResponse.json({message:"Check the information entered"},{status:400});
  }
  if(!input||typeof input!=="object"||Array.isArray(input))
    return NextResponse.json({message:"Check the information entered"},{status:400});
  const backend=process.env.BACKEND_URL;
  if(!backend)return NextResponse.json({message:"Account activation is unavailable"},{status:503});
  try{
    const result=await fetch(new URL("/api/identity/invitation/"+step,backend),{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(input),cache:"no-store",signal:AbortSignal.timeout(10000)
    });
    if(!result.ok){
      return NextResponse.json({message:result.status===429?"Too many attempts; try later.":
        result.status===400?"Invitation or verification could not be confirmed.":
        "Account activation is temporarily unavailable."},
        {status:[400,401,403,409,429].includes(result.status)?result.status:503});
    }
    const data:unknown=await result.json();
    const response=NextResponse.json(data,{status:200});
    response.headers.set("Cache-Control","private, no-store");
    return response;
  }catch{return NextResponse.json({message:"The outcome could not be confirmed. Check before retrying."},{status:503});}
}
