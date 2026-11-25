import {useEffect,useState} from "react";
import {AppState} from "react-native";
type Intro={heading:string;body:string;eyebrow:string;highlights:string[]};
type Placement="MEMBERSHIP"|"VOLUNTEER";
/** Read the same effective About intro placement as the public Web. No
 * cached/withdrawn editorial copy or privileged CMS endpoint. */
export function usePublicIntro(placement:Placement){
 const [intro,setIntro]=useState<Intro|null>(null);
 useEffect(()=>{
  let active=true,seq=0,controller:AbortController|null=null;
  const refresh=async()=>{
   controller?.abort();const stop=new AbortController();controller=stop;
   const request=++seq;setIntro(null);
   const base=process.env.EXPO_PUBLIC_API_URL;
   if(!base||!/^https?:\/\//.test(base)||(process.env.NODE_ENV==="production"&&!base.startsWith("https://")))return;
   const timeout=setTimeout(()=>stop.abort(),9000);
   try{
    const response=await fetch(new URL("/api/public/content/pages/about",base).toString(),{cache:"no-store",signal:stop.signal});
    if(!response.ok)return;
    const value:unknown=await response.json();
    if(!value||typeof value!=="object"||Array.isArray(value))return;
    const p=value as Record<string,unknown>;
    if(p.schemaVersion!==1||p.slug!=="about"||p.kind!=="ABOUT"||!Array.isArray(p.sections))return;
    const f=p.sections.find(s=>s&&s.kind==="RICH_TEXT"&&s.fields?.placement===placement)?.fields;
    if(!f||typeof f.heading!=="string"||typeof f.body!=="string")return;
    if(active&&request===seq)setIntro({heading:f.heading,body:f.body,eyebrow:typeof f.eyebrow==="string"?f.eyebrow:"",highlights:Array.isArray(f.highlights)?f.highlights.filter((v:unknown):v is string=>typeof v==="string").slice(0,4):[]});
   }catch{/* Editorial content is optional for the independent registration owner. */}
   finally{clearTimeout(timeout);}
  };
  void refresh();
  const sub=AppState.addEventListener("change",v=>{if(v==="active")void refresh();else{seq++;controller?.abort();setIntro(null);}});
  return()=>{active=false;seq++;controller?.abort();sub.remove();};
 },[placement]);
 return intro;
}
