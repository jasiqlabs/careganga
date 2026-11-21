import {NextRequest} from "next/server";
import {privateMisProxy} from "../private-mis-proxy";
export const dynamic="force-dynamic";
export const GET=(req:NextRequest)=>privateMisProxy(req,"schedules","GET");
export const POST=(req:NextRequest)=>privateMisProxy(req,"schedules","POST");
