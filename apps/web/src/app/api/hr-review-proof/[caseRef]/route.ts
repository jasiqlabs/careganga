import {cookies} from "next/headers";
import {NextRequest,NextResponse} from "next/server";
export const dynamic="force-dynamic";
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
type Ctx={params:Promise<{caseRef:string}>};
export async function GET(request:NextRequest,{params}:Ctx){
 const {caseRef}=await params,kind=request.nextUrl.searchParams.get("kind");
 if(!ID.test(caseRef)||!["HR_IDENTITY_PROOF","HR_QUALIFICATION","HR_PORTRAIT"].includes(kind??""))
  return NextResponse.json({message:"Choose an original employee proof."},{status:400});
 const token=(await cookies()).get("cg_staff_session")?.value;
 if(!token)return NextResponse.json({message:"Please sign in again."},{status:401});
 const backend=process.env.BACKEND_URL;
 if(!backend)return NextResponse.json({message:"Private proof cannot be accessed."},{status:503});
 try{
  const target=new URL("/api/hr/reviews/"+caseRef+"/proof/"+kind,backend);
  const result=await fetch(target,{method:"GET",cache:"no-store",
   signal:AbortSignal.timeout(20000),headers:{Authorization:"Bearer "+token}});
  if(!result.ok){
   const status=[400,401,403,404,409,429].includes(result.status)?
    result.status:503;
   return NextResponse.json({message:status===403?
    "This private employee proof is not permitted for your role.":
    status===404?"The original private proof is no longer available.":
    status===401?"Please sign in again.":
    "Original employee proof cannot be confirmed. Refresh the review."},
    {status,headers:{"Cache-Control":"private, no-store"}});
  }
  const mime=result.headers.get("content-type")?.split(";")[0]??"";
  if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mime))
   throw Error("Invalid original file content type");
  const bytes=await result.arrayBuffer();
  if(bytes.byteLength<1||bytes.byteLength>10485760)
   throw Error("Original private file size was not verified");
  const suffix=mime==="application/pdf"?"pdf":mime==="image/jpeg"?"jpg":
   mime==="image/png"?"png":"webp";
  return new NextResponse(bytes,{status:200,headers:{
   "Content-Type":mime,"Content-Disposition":
    'attachment; filename="careganga-private-employee-proof.'+suffix+'"',
   "Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff",
   "Content-Security-Policy":"default-src 'none'; sandbox"
  }});
 }catch{
  return NextResponse.json({message:"The original private file cannot be verified."},
   {status:503,headers:{"Cache-Control":"private, no-store"}});
 }
}
