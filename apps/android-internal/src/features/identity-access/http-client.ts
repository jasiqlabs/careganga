import { Platform } from "react-native";

const API_BASE=process.env.EXPO_PUBLIC_API_URL;

function resolveEndpoint(path: string): string {
  if (!API_BASE) throw new Error("Authentication service unavailable");
  let base = API_BASE;
  if (Platform.OS === "android" && (base.startsWith("http://localhost:") || base.startsWith("http://127.0.0.1:"))) {
    base = base.replace(/localhost|127\.0\.0\.1/, "10.0.2.2");
  }
  return new URL(path, base).toString();
}

export async function identityRequest(path:string,options:RequestInit={}):Promise<Response>{
  if(!API_BASE||!/^https?:\/\//.test(API_BASE)||
    (process.env.NODE_ENV==="production"&&!API_BASE.startsWith("https://")))
    throw new Error("Authentication service unavailable");
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),10000);
  try{return await fetch(resolveEndpoint(path),{...options,signal:abort.signal});}
  finally{clearTimeout(timeout);}
}
