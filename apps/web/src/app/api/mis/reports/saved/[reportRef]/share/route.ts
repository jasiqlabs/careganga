import {NextRequest,NextResponse} from "next/server";
import {privateMisProxy,validMisRef} from "../../../private-mis-proxy";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest,
 {params}:{params:Promise<{reportRef:string}>}){
 const {reportRef}=await params;
 if(!validMisRef(reportRef))
  return NextResponse.json({message:"Choose a saved report."},{
   status:400,headers:{"Cache-Control":"private, no-store"}});
 return privateMisProxy(req,"saved/"+reportRef+"/share","POST");
}
