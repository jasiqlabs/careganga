import {NextRequest,NextResponse} from "next/server";
import {privateMisProxy,validMisRef} from "../../../private-mis-proxy";
export const dynamic="force-dynamic";
export async function POST(req:NextRequest,{params}:{params:Promise<{scheduleRef:string}>}){
 const {scheduleRef}=await params;
 if(!validMisRef(scheduleRef))return NextResponse.json({message:"Choose a schedule."},{status:400});
 return privateMisProxy(req,"schedules/"+scheduleRef+"/pause","POST");
}
