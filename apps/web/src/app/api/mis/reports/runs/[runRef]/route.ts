import {NextRequest,NextResponse} from "next/server";
import {privateMisProxy,validMisRef} from "../../private-mis-proxy";
export const dynamic="force-dynamic";
export async function GET(req:NextRequest,{params}:{params:Promise<{runRef:string}>}){
 const {runRef}=await params;
 if(!validMisRef(runRef))return NextResponse.json({message:"Select a permitted report."},{status:400});
 return privateMisProxy(req,"runs/"+runRef,"GET");
}
