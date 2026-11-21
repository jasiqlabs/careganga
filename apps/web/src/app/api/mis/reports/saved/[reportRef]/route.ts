import {NextRequest,NextResponse} from "next/server";
import {privateMisProxy,validMisRef} from "../../private-mis-proxy";
export const dynamic="force-dynamic";
type Context={params:Promise<{reportRef:string}>};
export async function GET(request:NextRequest,ctx:Context){
 const {reportRef}=await ctx.params;
 if(!validMisRef(reportRef))return NextResponse.json({message:"Choose a saved report."},{status:400});
 return privateMisProxy(request,"saved/"+reportRef,"GET");
}
export async function PATCH(request:NextRequest,ctx:Context){
 const {reportRef}=await ctx.params;
 if(!validMisRef(reportRef))return NextResponse.json({message:"Choose a saved report."},{status:400});
 return privateMisProxy(request,"saved/"+reportRef,"PATCH");
}
