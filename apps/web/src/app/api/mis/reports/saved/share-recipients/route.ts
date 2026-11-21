import {NextRequest,NextResponse} from "next/server";
import {privateMisProxy} from "../../private-mis-proxy";
export const dynamic="force-dynamic";
/** CG01 searches current same-realm eligible staff; not a public directory. */
export async function GET(req:NextRequest){
 const q=req.nextUrl.searchParams.get("q")??"";
 if(q.trim().length<2||q.length>60)
  return NextResponse.json({message:"Enter at least two letters to find a colleague."},
   {status:400,headers:{"Cache-Control":"private, no-store"}});
 return privateMisProxy(req,"saved/share-recipients?q="+encodeURIComponent(q),"GET");
}
