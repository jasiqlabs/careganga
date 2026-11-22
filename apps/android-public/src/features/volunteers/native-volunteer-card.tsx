import {useCallback,useEffect,useRef,useState} from "react";
import {AppState,Pressable,StyleSheet,Text,View} from "react-native";
import {File,Paths} from "expo-file-system";
import {fetch as expoFetch} from "expo/fetch";
import * as Sharing from "expo-sharing";
import * as Crypto from "expo-crypto";
import type {CG19OwnVolunteerCards} from "@careganga/api-contracts";
import {memberEndpoint,memberInvoke} from "../membership/member-native-api";
const label=(s:string)=>s.replaceAll("_"," ").toLowerCase().replace(/\b[a-z]/g,c=>c.toUpperCase());
const endpoint="/api/v1/volunteers/documents";
export function NativeVolunteerCard({token,onExpired}:{token:string;onExpired:()=>void}){
 const [cards,setCards]=useState<CG19OwnVolunteerCards|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const seq=useRef(0),files=useRef<File[]>([]);
 const refresh=useCallback(async()=>{
  const n=++seq.current;setBusy(true);setError("");
  try{const data=await memberInvoke<CG19OwnVolunteerCards>(endpoint+"/me","GET",undefined,token);
   if(n===seq.current)setCards(data);
  }catch(e){if(n===seq.current){setCards(null);setError("Current official volunteer card status could not be verified.");
   if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  }}finally{if(n===seq.current)setBusy(false);}
 },[token,onExpired]);
 useEffect(()=>{void refresh();return()=>{seq.current++;};},[refresh]);
 useEffect(()=>{
  const removeFiles=()=>{for(const f of files.current)try{f.delete();}catch{}files.current=[];};
  const sub=AppState.addEventListener("change",state=>{if(state!=="active"){seq.current++;setCards(null);removeFiles();}else void refresh();});
  return()=>{sub.remove();removeFiles();};
 },[refresh]);
 const download=(ref:string)=>{if(busy)return;setBusy(true);setError("");
  void (async()=>{
   let local:File|null=null;
   try{
    const r=await expoFetch(memberEndpoint(endpoint+"/cards/"+ref+"/download"),{
     cache:"no-store",headers:{Authorization:"Bearer "+token}});
    if(!r.ok){if(r.status===401)onExpired();throw Error("Official volunteer card is not currently available.");}
    if((r.headers.get("content-type")??"").split(";")[0].trim()!=="application/pdf")throw Error("Unexpected protected document content.");
    const bytes=await r.bytes();if(bytes.length<1||bytes.length>10485760)throw Error("Original issued PDF is unavailable.");
    local=new File(Paths.cache,"careganga-volunteer-"+Crypto.randomUUID()+".pdf");
    await local.write(bytes);files.current.push(local);
    if(!(await Sharing.isAvailableAsync()))throw Error("Private document viewing is unavailable.");
    await Sharing.shareAsync(local.uri,{mimeType:"application/pdf",dialogTitle:"My official CareGanga volunteer card"});
   }catch(e){setError(e instanceof Error?e.message:"The official card download was not confirmed.");}
   finally{if(local){try{local.delete();}catch{}files.current=files.current.filter(f=>f.uri!==local!.uri);}setBusy(false);}
  })();
 };
 return <View style={s.card}>
  <Text style={s.heading}>My official volunteer card</Text>
  <Text>Only a genuinely issued CG-19 volunteer card may be downloaded. Approval alone is not a staff ID.</Text>
  {!!error&&<Text accessibilityRole="alert">{error}</Text>}
  {cards?.items.length?cards.items.map(v=><View key={v.cardRef} style={s.row}>
   <Text>{label(v.status)} · Issue {v.revision}</Text>
   {v.canDownload?<Pressable accessibilityRole="button" disabled={busy} onPress={()=>download(v.cardRef)} style={s.button}><Text>Open my issued PDF privately</Text></Pressable>:
    <Text>Official card not currently issued.</Text>}
  </View>):<Text>{cards?"No official volunteer card issued.":"Official card status not yet confirmed."}</Text>}
  <Pressable accessibilityRole="button" disabled={busy} onPress={()=>void refresh()} style={s.button}><Text>Refresh official card status</Text></Pressable>
 </View>;
}
const s=StyleSheet.create({card:{padding:14,gap:12,borderRadius:12,backgroundColor:"white",borderWidth:1,borderColor:"#d6e2dd"},heading:{fontSize:17,fontWeight:"700",color:"#163e32"},row:{gap:8},button:{padding:10,minHeight:44,borderRadius:8,borderWidth:1,borderColor:"#b8cfbf",justifyContent:"center"}});
