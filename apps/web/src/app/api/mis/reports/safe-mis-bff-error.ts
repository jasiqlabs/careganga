/** The original SafeErrorsFilter supplies allowlisted business copy only.
 * Never proxy a raw exception, SQL text, request ID, provider payload or
 * caller-supplied error body. A generic fallback is required otherwise.
 */
export async function safeMisBffError(response:Response,fallback:string){
 if(response.status<400||response.status>=500)return fallback;
 try{
  const value:unknown=await response.json();
  if(!value||typeof value!=="object"||Array.isArray(value))return fallback;
  const obj=value as Record<string,unknown>;
  if(typeof obj.code!=="string"||
     !/^(?:MIS_|CG15_MIS_)[A-Z0-9_]{3,70}$/.test(obj.code)||
     typeof obj.message!=="string"||obj.message.length<15||
     obj.message.length>240||/[<>\r\n\u0000-\u001f]/.test(obj.message))
   return fallback;
  return obj.message;
 }catch{return fallback;}
}
