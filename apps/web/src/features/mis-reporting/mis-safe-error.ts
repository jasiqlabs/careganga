/** UI receives only our same-origin BFF response. Never show a raw
 * backend exception, database identifier or provider status to users.
 */
export async function safeClientProblem(response:Response,fallback:string){
 try{
  const body:unknown=await response.json();
  if(body&&typeof body==="object"&&!Array.isArray(body)&&
     "message" in body&&typeof body.message==="string"&&
     body.message.length>=12&&body.message.length<=250&&
     !/[<>\r\n\u0000-\u001f]/.test(body.message))
   return body.message;
 }catch{/* Unknown response retains action-specific fallback copy. */}
 return fallback;
}
