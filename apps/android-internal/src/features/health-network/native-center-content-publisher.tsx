import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Alert,Pressable,StyleSheet,Text,TextInput,View}
 from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Entry={caseRef:string;reference:string;centerRef:string;centerName:string;
 status:string;readyToPublish:boolean;isCurrentPublished:boolean;
 publicationGeneration:number|null;approvedRevisionRef:string|null};
type Props={token:string;onExpired:()=>void};
async function req<T>(token:string,path:string,body?:object):Promise<T>{
 const response=await identityRequest("/api/v1/health-network/my-centers/"+path,{
  method:body?"POST":"GET",cache:"no-store",
  headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok)throw Object.assign(new Error(
  response.status===401?"Sign in again.":
  response.status===403?"Only authorized Foundation publishers can do this.":
  "The original approved center publication could not be verified."
 ),{status:response.status});
 return response.json() as Promise<T>;
}
export function NativeCenterContentPublisher({token,onExpired}:Props){
 const [records,setRecords]=useState<Entry[]>([]);
 const [password,setPassword]=useState("");
 const [busy,setBusy]=useState(false),[uncertain,setUncertain]=useState(false);
 const [error,setError]=useState(""),[notice,setNotice]=useState("");
 const [loading,setLoading]=useState(true);
 const fail=(e:unknown)=>{
  if(e&&typeof e==="object"&&"status" in e&&e.status===401)onExpired();
  setError(e instanceof Error?e.message:"Approved publication status unavailable.");
 };
 const refresh=useCallback(async()=>{
  const data=await req<{cases:Entry[]}>(token,"content/publishing");
  if(!data||!Array.isArray(data.cases))throw Error("Original publisher queue unavailable.");
  setRecords(data.cases);setUncertain(false);
 },[token]);
 useEffect(()=>{
  let live=true;setLoading(true);
  void refresh().catch(e=>{if(live)fail(e)})
   .finally(()=>{if(live)setLoading(false)});
  return()=>{live=false};
 },[refresh]);
 const button=(label:string,fn:()=>void,disabled=false)=>
  <Pressable accessibilityRole="button" disabled={disabled}
   accessibilityState={{disabled}} onPress={fn}
   style={[styles.button,disabled&&styles.disabled]}>
   <Text style={styles.text}>{label}</Text>
  </Pressable>;
 async function change(item:Entry,action:"publish"|"withdraw"){
  if(busy||uncertain||password.length<8)return;
  if(action==="publish"&&!item.readyToPublish)return;
  if(action==="withdraw"&&(!item.isCurrentPublished||
   item.publicationGeneration===null||!item.approvedRevisionRef))return;
  setBusy(true);setError("");setNotice("");
  const path=action==="publish"?
   "content/reviews/"+encodeURIComponent(item.caseRef)+"/apply":
   encodeURIComponent(item.centerRef)+"/content/withdraw";
  try{
   await req(token,path,action==="publish"?{currentPassword:password}:{
    currentPassword:password,expectedGeneration:item.publicationGeneration,
    approvedRevisionRef:item.approvedRevisionRef});
   setPassword("");await refresh();
   setNotice(action==="publish"?
    "Independently approved center presentation published.":
    "Original public presentation withdrawn.");
  }catch(e){setUncertain(true);fail(e)}finally{setBusy(false)}
 }
 return <View style={styles.panel}>
  <Text style={styles.heading}>Approved center content publication</Text>
  <Text style={styles.note}>Only original reviewed revisions may be published;
   the center author cannot grant their own approval.</Text>
  {!!error&&<Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
  {!!notice&&<Text accessibilityRole="alert" style={styles.note}>{notice}</Text>}
  {uncertain&&<Text style={styles.error}>Publication outcome uncertain.
   Refresh current original entries before trying another action.</Text>}
  {loading&&<ActivityIndicator accessibilityLabel="Checking approved center content"/>}
  {button("Refresh actual publication queue",()=>{
   setLoading(true);void refresh().catch(fail).finally(()=>setLoading(false));
  },busy)}
  <TextInput style={styles.input} accessibilityLabel="Current Foundation publisher password"
   secureTextEntry placeholder="Current password" value={password}
   onChangeText={setPassword} editable={!busy&&!uncertain}/>
  {records.map(item=><View key={item.caseRef} style={styles.panel}>
   <Text style={styles.heading}>{item.centerName}</Text>
   <Text style={styles.note}>Review {item.status} ·
    {item.isCurrentPublished?" Current public":" Not published"}</Text>
   {item.readyToPublish&&button("Publish independently approved revision",()=>
    Alert.alert("Publish approved center content?",
     "Only the currently approved original presentation becomes public.",[
      {text:"Cancel",style:"cancel"},
      {text:"Publish",onPress:()=>void change(item,"publish")}
     ]),busy||uncertain||password.length<8)}
   {item.isCurrentPublished&&button("Withdraw this published presentation",()=>
    Alert.alert("Withdraw current public presentation?",
     "The approved source history remains intact.",[
      {text:"Cancel",style:"cancel"},
      {text:"Withdraw",style:"destructive",
       onPress:()=>void change(item,"withdraw")}
     ]),busy||uncertain||password.length<8)}
  </View>)}
 </View>;
}
const styles=StyleSheet.create({
 panel:{backgroundColor:t.surface,padding:10,gap:8,
  borderWidth:1,borderColor:t.border,borderRadius:12},
 heading:{fontSize:16,fontWeight:"700",color:t.text},
 note:{fontSize:13,color:t.mutedText,lineHeight:18},
 error:{color:"#A52626",fontSize:13},
 text:{color:t.text,fontSize:13,fontWeight:"600"},
 button:{borderWidth:1,borderColor:t.border,borderRadius:9,
  minHeight:44,padding:10,justifyContent:"center"},
 disabled:{opacity:.4},
 input:{backgroundColor:t.surface,borderWidth:1,borderColor:t.border,
  borderRadius:9,color:t.text,padding:10,minHeight:45}
});
