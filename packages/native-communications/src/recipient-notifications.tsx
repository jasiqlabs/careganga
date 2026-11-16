import {useCallback,useEffect,useRef,useState} from "react";
import {
  ActivityIndicator,Pressable,ScrollView,StyleSheet,Switch,
  Text,View
} from "react-native";
import {careGangaTheme as theme} from "../../design-tokens/src/index";

type Inbox={notificationRef:string;title:string;body:string;
  channel:"IN_APP"|"EMAIL"|"SMS";status:string;receivedAt:string;read:boolean};
type Preference={channel:"EMAIL"|"SMS";purpose:"TRANSACTIONAL"|"PROMOTIONAL";
  opted_in:boolean;revision:number};
type Prefs={available:{email:boolean;sms:boolean};preferences:Preference[]};
type Props={
  token:string;onExpired:()=>void;onExit?:()=>void;
  makeRequest:(token:string,path:string,options?:RequestInit)=>Promise<Response>
};
const channelName={EMAIL:"Email",SMS:"SMS"} as const;
function errorMessage(error:unknown){
  if(error instanceof Error&&error.message==="EXPIRED")
    return "Session expired. Please sign in again.";
  if(error instanceof Error&&error.message==="FORBIDDEN")
    return "Your role does not currently permit this notice.";
  return "The result could not be verified. Check the original status before repeating.";
}
async function json<T>(client:Props["makeRequest"],token:string,
  path:string,options:RequestInit={}):Promise<T>{
  let response:Response;
  try{response=await client(token,"/api/communications/"+path,options);}
  catch{throw Error("UNKNOWN");}
  if(response.status===401)throw Error("EXPIRED");
  if(response.status===403)throw Error("FORBIDDEN");
  if(!response.ok)throw Error("UNKNOWN");
  try{return await response.json() as T;}catch{throw Error("UNKNOWN")}
}
/** The same CG-01 authenticated, own-recipient UI is used in both Android
 * apps. No admin send controls or guessed public accounts on Public Android.
 */
export function RecipientNotifications({
  token,onExpired,onExit,makeRequest
}:Props){
  const [notices,setNotices]=useState<Inbox[]>([]);
  const [prefs,setPrefs]=useState<Prefs|null>(null);
  const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [error,setError]=useState(""),[success,setSuccess]=useState("");
  const generation=useRef(0);
  const reload=useCallback(async()=>{
    const at=++generation.current;
    setLoading(true);setError("");
    try{
      const [messages,settings]=await Promise.all([
        json<{items:Inbox[]}>(makeRequest,token,"inbox?limit=30"),
        json<Prefs>(makeRequest,token,"preferences")
      ]);
      if(!Array.isArray(messages.items)||messages.items.length>30||
        messages.items.some(x=>typeof x.notificationRef!=="string"||
          typeof x.title!=="string"||typeof x.read!=="boolean")||
        !settings||!Array.isArray(settings.preferences))throw Error("UNKNOWN");
      if(at!==generation.current)return;
      setNotices(messages.items);setPrefs(settings);
    }catch(e){
      if(at!==generation.current)return;
      setNotices([]);setPrefs(null);setError(errorMessage(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{if(at===generation.current)setLoading(false);}
  },[token,onExpired,makeRequest]);
  useEffect(()=>{void reload();return()=>{++generation.current};},[reload]);
  async function read(ref:string){
    if(busy)return;
    setBusy(true);setError("");setSuccess("");
    try{
      await json(makeRequest,token,"inbox/"+encodeURIComponent(ref)+"/read",{
        method:"POST"
      });
      await reload();
      setSuccess("Marked read for your own account.");
    }catch(e){
      setError(errorMessage(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false);}
  }
  async function preference(channel:"EMAIL"|"SMS",
    purpose:"TRANSACTIONAL"|"PROMOTIONAL",value:boolean){
    if(busy||!prefs)return;
    const prior=prefs.preferences.find(x=>x.channel===channel&&x.purpose===purpose);
    setBusy(true);setError("");setSuccess("");
    try{
      await json(makeRequest,token,"preferences",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({channel,purpose,optedIn:value,
          expectedRevision:prior?.revision??0})
      });
      await reload();
      setSuccess("Current contact preference saved.");
    }catch(e){
      setError(errorMessage(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setBusy(false);}
  }
  return <ScrollView keyboardShouldPersistTaps="handled"
    contentContainerStyle={styles.content}>
    <View style={styles.row}>
      {onExit&&<Pressable accessibilityRole="button" style={styles.button}
        disabled={busy} onPress={onExit}><Text>Back</Text></Pressable>}
      <Text accessibilityRole="header" style={styles.title}>My Foundation notices</Text>
    </View>
    <Text style={styles.sub}>Private notifications for your signed-in account.
      Provider acceptance is not proof of delivery.</Text>
    {!!error&&<Text accessibilityRole="alert" style={styles.alert}>{error}</Text>}
    {!!success&&<Text accessibilityRole="alert" style={styles.success}>{success}</Text>}
    <Pressable accessibilityRole="button" style={styles.button}
      disabled={busy||loading} onPress={()=>void reload()}>
      <Text>Refresh verified notices</Text>
    </Pressable>
    {loading?<ActivityIndicator accessibilityLabel="Verifying notification access"/>:
    <>
      <View style={styles.card}>
        <Text style={styles.heading}>Notifications</Text>
        {!notices.length?<Text>No current notices for this account.</Text>:
          notices.map(item=><View key={item.notificationRef} style={styles.item}>
            <Text style={styles.heading}>{item.title}</Text>
            <Text>{item.body}</Text>
            <Text style={styles.sub}>{item.channel} · {item.status.replace(/_/g," ")}
              {" · "}{new Date(item.receivedAt).toLocaleString()}</Text>
            {!item.read&&<Pressable accessibilityRole="button" style={styles.button}
              disabled={busy} onPress={()=>void read(item.notificationRef)}>
              <Text>Mark as read</Text>
            </Pressable>}
          </View>)}
      </View>
      {prefs&&<View style={styles.card}>
        <Text style={styles.heading}>My contact preferences</Text>
        <Text style={styles.sub}>Email or SMS is never sent without a verified
          CG-01 contact and the required purpose-specific opt-in.</Text>
        {(["EMAIL","SMS"] as const).map(channel=>(
          <View key={channel} style={styles.item}>
            <Text style={styles.heading}>{channelName[channel]} ·
              {" "}{(channel==="EMAIL"?prefs.available.email:prefs.available.sms)?
                "verified":"not verified"}
            </Text>
            {(["TRANSACTIONAL","PROMOTIONAL"] as const).map(purpose=>{
              const existing=prefs.preferences.find(x=>x.channel===channel&&x.purpose===purpose);
              const verified=channel==="EMAIL"?prefs.available.email:prefs.available.sms;
              return <View key={purpose} style={styles.row}>
                <Text style={styles.wrap}>{purpose==="TRANSACTIONAL"?
                  "Foundation service updates":"Optional campaign messages"}</Text>
                <Switch accessibilityLabel={channel+" "+purpose+" consent"}
                  disabled={!verified||busy} value={existing?.opted_in??false}
                  onValueChange={v=>void preference(channel,purpose,v)}
                  trackColor={{true:theme.selectedNavigation}}/>
              </View>;
            })}
          </View>
        ))}
      </View>}
    </>}
  </ScrollView>;
}
const styles=StyleSheet.create({
  content:{padding:18,gap:14,paddingBottom:44,alignSelf:"center",width:"100%",maxWidth:720},
  row:{flexDirection:"row",alignItems:"center",gap:12,justifyContent:"space-between"},
  wrap:{fontSize:13,color:theme.text,flex:1},
  title:{fontWeight:"700",fontSize:23,color:theme.sidebar,flexShrink:1},
  heading:{fontWeight:"700",fontSize:16,color:theme.text},
  sub:{fontSize:13,color:theme.mutedText},
  alert:{padding:12,color:theme.error,backgroundColor:theme.surface},
  success:{padding:12,color:theme.sidebar,backgroundColor:theme.surface},
  card:{backgroundColor:theme.surface,borderRadius:12,borderWidth:1,
    borderColor:theme.border,padding:15,gap:12},
  item:{borderBottomWidth:1,borderBottomColor:theme.border,paddingVertical:10,gap:10},
  button:{paddingHorizontal:14,paddingVertical:12,minHeight:48,alignItems:"center",
    justifyContent:"center",borderWidth:1,borderColor:theme.border,borderRadius:8}
});
