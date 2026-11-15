const API_BASE=process.env.EXPO_PUBLIC_API_URL;

export async function identityRequest(path:string,options:RequestInit={}):Promise<Response>{
  if(!API_BASE||!/^https?:\/\//.test(API_BASE)||
    (process.env.NODE_ENV==="production"&&!API_BASE.startsWith("https://")))
    throw new Error("Authentication service unavailable");
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),10000);
  try{return await fetch(new URL(path,API_BASE).toString(),{...options,signal:abort.signal});}
  finally{clearTimeout(timeout);}
}
