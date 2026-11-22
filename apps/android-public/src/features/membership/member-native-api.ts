import {Platform} from "react-native";
const raw=process.env.EXPO_PUBLIC_API_URL;
export function memberEndpoint(path:string):string{
 if(!raw||!/^https?:\/\//.test(raw)||(process.env.NODE_ENV==="production"&&!raw.startsWith("https://")))
  throw new Error("Membership service is not configured.");
 const base=Platform.OS==="android"?raw.replace(/http:\/\/(localhost|127\.0\.0\.1):/,"http://10.0.2.2:"):raw;
 return new URL(path,base).toString();
}
export async function memberInvoke<T>(path:string,method:"GET"|"POST"|"PATCH"="GET",body?:Record<string,unknown>,token?:string|null):Promise<T>{
 const r=await fetch(memberEndpoint(path),{method,cache:"no-store",signal:AbortSignal.timeout(15000),
  headers:{...(token?{Authorization:"Bearer "+token}:{}),...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
 if(!r.ok){const e:unknown=await r.json().catch(()=>null);const data=e&&typeof e==="object"&&!Array.isArray(e)?e as Record<string,unknown>:{};
  const text=typeof data.message==="string"&&data.message.length<220?data.message:r.status===401?"Your membership session expired. Sign in again.":r.status===403?"This account is not permitted to perform that action.":r.status===409?"This membership record changed. Refresh before retrying.":r.status===429?"Too many attempts. Try again later.":"The membership result could not be confirmed.";
  throw Object.assign(new Error(text),{status:r.status});
 }
 return r.json() as Promise<T>;
}
