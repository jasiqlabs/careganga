import {NextRequest} from "next/server";
import {privateMisProxy} from "../../private-mis-proxy";
export const dynamic="force-dynamic";
/** Only explicitly shared private definitions, never report data or files. */
export async function GET(req:NextRequest){
 return privateMisProxy(req,"saved/shared-with-me","GET");
}
