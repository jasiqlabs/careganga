import type {NextRequest} from "next/server";
import {GET as getReview} from "./[...parts]/route";
export const dynamic="force-dynamic";
export function GET(request:NextRequest){
  return getReview(request,{params:Promise.resolve({parts:[]})});
}
