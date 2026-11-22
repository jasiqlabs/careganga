import {careGangaTheme as hrTheme} from "../../../../../packages/design-tokens/src/index";
import React,{useCallback,useEffect,useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {identityRequest} from "../identity-access/http-client";
type Bio={linked:boolean;consented:boolean;revision:number};
async function request(token:string,method:"GET"|"POST"="GET",
 body?:{consent:boolean;expectedRevision:number}){
 const res=await identityRequest("/api/hr/my-bio-consent",{
  method,cache:"no-store",headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!res.ok)throw Object.assign(new Error(res.status===401?
   "Session expired. Sign in again.":
   res.status===409?"Professional permission changed. Refresh before updating.":
   "The original public-use consent status cannot be verified."),{status:res.status});
 return res.json() as Promise<unknown>;
}
export function NativeHrBioConsent({token,onExpired}:{
 token:string;onExpired:()=>void;
}){
 const [value,setValue]=useState<Bio|null>(null);
 const [busy,setBusy]=useState(false),[problem,setProblem]=useState("");
 const [notice,setNotice]=useState("");
 const failure=useCallback((e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setProblem(e instanceof Error?e.message:"Current professional permission is unavailable.");
 },[onExpired]);
 const refresh=useCallback(async()=>{
  try{
   const current=await request(token);
   if(!current||typeof current!=="object"||!("linked" in current)||
      typeof current.linked!=="boolean"||!("consented" in current)||
      typeof current.consented!=="boolean"||!("revision" in current)||
      typeof current.revision!=="number")
    throw Error("Original professional consent cannot be verified.");
   setValue(current as Bio);
  }catch(e){setValue(null);failure(e);}
 },[token,failure]);
 useEffect(()=>{void refresh();},[refresh]);
 const decide=async()=>{
  if(!value?.linked||busy)return;
  const consent=!value.consented;
  setBusy(true);setProblem("");setNotice("");
  try{
   const result=await request(token,"POST",{
    consent,expectedRevision:value.revision});
   if(!result||typeof result!=="object"||!("revision" in result)||
      typeof result.revision!=="number")
    throw Error("Professional permission change cannot be confirmed.");
   await refresh();
   setNotice(consent?
    "Limited professional-use consent recorded. Separate editorial approval is required.":
    "Professional profile permission withdrawn.");
  }catch(e){failure(e);}
  finally{setBusy(false);}
 };
 if(!value?.linked)return null;
 return <View style={styles.card}>
  <Text style={styles.heading}>Optional professional profile permission</Text>
  <Text style={styles.muted}>Only your professional name and current designation
   can be considered for a future Foundation Team profile.
   Private ID documents and scanned photographs are never public media.
   Separate editorial approval remains required.</Text>
  <Text style={styles.muted}>Current permission: {value.consented?"Granted":"Not granted"}</Text>
  {!!problem&&<Text accessibilityRole="alert" style={styles.problem}>{problem}</Text>}
  {!!notice&&<Text style={styles.notice}>{notice}</Text>}
  <Pressable accessibilityRole="button" style={styles.button}
   disabled={busy} onPress={()=>void decide()}>
   <Text style={styles.buttonText}>{busy?"Confirming choice…":value.consented?
    "Withdraw professional profile permission":"Allow limited professional profile"}</Text>
  </Pressable>
  <Pressable accessibilityRole="button" style={styles.secondary}
   disabled={busy} onPress={()=>void refresh()}>
   <Text style={styles.secondaryText}>Refresh current permission</Text>
  </Pressable>
 </View>;
}
const styles=StyleSheet.create({
 card:{padding:14,gap:10,borderWidth:1,borderColor:hrTheme.border,borderRadius:12,backgroundColor:hrTheme.surface},
 heading:{fontSize:16,fontWeight:"700",color:hrTheme.text},
 muted:{fontSize:13,color:hrTheme.mutedText,lineHeight:19},
 problem:{color:"#991B1B"},notice:{color:"#166534"},
 button:{padding:11,borderRadius:9,backgroundColor:hrTheme.primary,alignSelf:"flex-start"},
 buttonText:{color:hrTheme.surface,fontWeight:"700"},
 secondary:{padding:9,borderRadius:9,backgroundColor:"#F1F5F9",alignSelf:"flex-start"},
 secondaryText:{fontWeight:"600",color:hrTheme.text}
});
