/** CG-20 errors come from the original API SafeErrorsFilter and its approved
 * semantic copy. Do not expose raw server/SQL/provider text, codes or UUIDs
 * in the Android screen.
 */
export async function nativeMisProblem(response:Response,fallback:string){
 let message=fallback;
 if(response.status>=400&&response.status<500){
  try{
   const body:unknown=await response.json();
   if(body&&typeof body==="object"&&!Array.isArray(body)){
    const value=body as Record<string,unknown>;
    if(typeof value.code==="string"&&
       /^(?:MIS_|CG15_MIS_)[A-Z0-9_]{3,70}$/.test(value.code)&&
       typeof value.message==="string"&&
       value.message.length>=15&&value.message.length<=240&&
       !/[<>\r\n\u0000-\u001f]/.test(value.message))
     message=value.message;
   }
  }catch{/* Unrecognized error keeps safe next-action guidance. */}
 }
 return Object.assign(new Error(message),{status:response.status});
}
