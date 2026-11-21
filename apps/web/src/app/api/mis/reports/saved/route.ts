import {NextRequest} from "next/server";
import {privateMisProxy} from "../private-mis-proxy";
export const dynamic="force-dynamic";
export const GET=(request:NextRequest)=>privateMisProxy(request,"saved","GET");
export const POST=(request:NextRequest)=>privateMisProxy(request,"saved","POST");
