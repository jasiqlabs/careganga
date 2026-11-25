import {useCallback,useEffect,useState} from "react";
import {ActivityIndicator,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {identityRequest} from "../identity-access/http-client";
type Notification={notificationRef:string;title:string;body:string;channel:string;
  status:string;receivedAt:string;read:boolean};
type Preference={channel:"SMS"|"EMAIL";purpose:"TRANSACTIONAL"|"PROMOTIONAL";
  opted_in:boolean;revision:number};
type Preferences={available:{sms:boolean;email:boolean};preferences:Preference[]};
type MobileProof={hasNumber:boolean;verified:boolean;maskedContact:string|null;
 verifiedAt:string|null;providerConfigured:boolean};
type Props={token:string;onExit:()=>void;onExpired:()=>void};
async function mobile<T>(token:string,path:string,method:"GET"|"POST"="GET",
 body?:object):Promise<T>{
 let r:Response;
 try{r=await identityRequest("/api/identity/mobile/"+path,{
  method,headers:{Authorization:"Bearer "+token,
   ...(body?{"Content-Type":"application/json"}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 })}catch{throw Error("OFFLINE")}
 if(r.status===401)throw Error("EXPIRED");
 if(r.status===403)throw Error("DENIED");
 if(!r.ok)throw Error("OFFLINE");
 try{return await r.json() as T}catch{throw Error("OFFLINE")}
}
async function api<T>(token:string,path:string,method:"GET"|"POST"="GET",body?:object){
  let response:Response;
  try{response=await identityRequest("/api/communications/"+path,{
    method,headers:{Authorization:"Bearer "+token,
      ...(body?{"Content-Type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });}catch{throw Error(method==="POST"?"UNKNOWN":"OFFLINE")}
  if(response.status===401)throw Error("EXPIRED");
  if(response.status===403)throw Error("DENIED");
  if(response.status===409)throw Error("STALE");
  if(!response.ok)throw Error(method==="POST"?"UNKNOWN":"OFFLINE");
  try{return await response.json() as T;}
  catch{throw Error("UNKNOWN")}
}
function explain(e:unknown){
  const code=e instanceof Error?e.message:"UNKNOWN";
  return code==="EXPIRED"?"Session expired. Please sign in again.":
    code==="DENIED"?"Your current role does not allow this notice.":
    code==="STALE"?"The preference changed. Refresh before saving.":
    "The notification result could not be confirmed. Refresh its original state.";
}
export function NotificationsScreen({token,onExit,onExpired}:Props){
  const [rows,setRows]=useState<Notification[]>([]);
  const [prefs,setPrefs]=useState<Preferences|null>(null);
  const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true);
  const [notice,setNotice]=useState("");
  const [mobileProof,setMobileProof]=useState<MobileProof|null>(null);
  const [mobileCode,setMobileCode]=useState("");
  const [mobileBusy,setMobileBusy]=useState(false);
  const refresh=useCallback(async()=>{
    setLoading(true);
    try{
      const [messages,settings]=await Promise.all([
        api<{items:Notification[]}>(token,"inbox?limit=30"),
        api<Preferences>(token,"preferences")
      ]);
      if(!Array.isArray(messages.items)||messages.items.length>30||
        !settings||!Array.isArray(settings.preferences))throw Error("OFFLINE");
      setRows(messages.items);setPrefs(settings);
      // CG01 contact proof is independent of the CG19 notices query.
      // A disabled provider must not hide the user's existing inbox.
      try{
        const proof=await mobile<MobileProof>(token,"status");
        if(typeof proof.verified!=="boolean"||
           typeof proof.hasNumber!=="boolean"||
           typeof proof.providerConfigured!=="boolean")throw Error("OFFLINE");
        setMobileProof(proof);
      }catch(e){
        setMobileProof(null);
        if(e instanceof Error&&e.message==="EXPIRED")onExpired();
      }
    }catch(e){
      setRows([]);setPrefs(null);setNotice(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setLoading(false);}
  },[token,onExpired]);
  useEffect(()=>{void refresh()},[refresh]);
  async function read(id:string){
    if(busy)return;
    setBusy(true);setNotice("");
    try{
      await api(token,"inbox/"+encodeURIComponent(id)+"/read","POST");
      await refresh();
    }catch(e){setNotice(explain(e));if(e instanceof Error&&
      e.message==="EXPIRED")onExpired()}
    finally{setBusy(false);}
  }
  async function preference(channel:"EMAIL"|"SMS",
    purpose:"TRANSACTIONAL"|"PROMOTIONAL"){
    if(!prefs||busy)return;
    const eligible=channel==="EMAIL"?prefs.available.email:prefs.available.sms;
    const old=prefs.preferences.find(x=>x.channel===channel&&x.purpose===purpose);
    if(!eligible){
      setNotice("Verify this contact through CareGanga identity first.");
      return;
    }
    setBusy(true);setNotice("");
    try{
      const data=await api<{status:string;revision:number}>(token,
        "preferences","POST",{
          channel,purpose,optedIn:!old?.opted_in,expectedRevision:old?.revision??0
        });
      if(data.status!=="SAVED")throw Error("UNKNOWN");
      await refresh();
    }catch(e){setNotice(explain(e));if(e instanceof Error&&
      e.message==="EXPIRED")onExpired()}
    finally{setBusy(false);}
  }
  async function startMobileProof(){
    if(busy||mobileBusy||mobileProof?.verified||
      !mobileProof?.hasNumber||!mobileProof.providerConfigured)return;
    setMobileBusy(true);setNotice("");
    try{
      const result=await mobile<{status:string}>(token,"verify/start","POST");
      if(result.status==="ALREADY_VERIFIED"){
        setNotice("Your original contact is already verified.");
      }else if(result.status==="PREVIOUS_REQUEST_PENDING"){
        setNotice("An original verification code request is still pending. "+
          "Check your existing SMS instead of requesting another.");
      }else if(result.status==="CODE_REQUESTED_UNCONFIRMED_DELIVERY"){
        setNotice("Verification SMS requested. Actual delivery is not confirmed.");
      }else if(result.status==="PROVIDER_UNKNOWN"){
        setNotice("The original SMS provider response was uncertain. "+
          "Check the recorded code before requesting another.");
      }else{
        setNotice("The original mobile verification request was not confirmed.");
      }
    }catch(e){
      setNotice(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setMobileBusy(false)}
  }
  async function confirmMobileProof(){
    if(busy||mobileBusy||mobileProof?.verified||
      !/^\d{4,10}$/.test(mobileCode))return;
    setMobileBusy(true);setNotice("");
    try{
      const result=await mobile<{status:string}>(token,
        "verify/confirm","POST",{code:mobileCode});
      // Never mark the contact verified before CG01 provider+DB confirms it.
      if(result.status==="VERIFIED"){
        setMobileCode("");
        const proof=await mobile<MobileProof>(token,"status");
        if(!proof.verified)throw Error("OFFLINE");
        setMobileProof(proof);
        setNotice("CG01 verified the recorded mobile number.");
      }else{
        setNotice(result.status==="NOT_VERIFIED"?
          "The received code was not verified. Check the original SMS.":
          "Provider confirmation is uncertain. Check original status before retrying.");
      }
    }catch(e){
      setNotice(explain(e));
      if(e instanceof Error&&e.message==="EXPIRED")onExpired();
    }finally{setMobileBusy(false)}
  }
  const unread=rows.filter(x=>!x.read).length;
  return <SafeAreaView style={styles.page} edges={["left","right"]}><ScrollView
    contentContainerStyle={styles.content}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" style={styles.button}
        onPress={onExit} disabled={busy}><Text>Back</Text></Pressable>
      <Text accessibilityRole="header" style={styles.title}>Notices &amp; Notifications</Text>
    </View>
    <Text style={styles.muted}>Current Foundation account only.
      No contacts or notices from another account are shown.</Text>
    {!!notice&&<Text accessibilityRole="alert" style={styles.error}>{notice}</Text>}
    <View style={styles.card}>
      <Text style={styles.heading}>Unread updates: {unread}</Text>
      <Pressable accessibilityRole="button" style={styles.button}
        disabled={busy||loading} onPress={()=>void refresh()}>
        <Text>Refresh verified notices</Text>
      </Pressable>
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>My updates</Text>
      {loading?<ActivityIndicator accessibilityLabel="Verifying own notices"/>:
        !rows.length?<Text>No current notifications.</Text>:
        rows.map(item=><View style={styles.item} key={item.notificationRef}>
          <Text style={styles.heading}>{item.title}</Text>
          <Text>{item.body}</Text>
          <Text style={styles.muted}>{item.channel} · {item.status.replace(/_/g," ")}</Text>
          <Text style={styles.muted}>{new Date(item.receivedAt).toLocaleString()}</Text>
          {!item.read&&<Pressable style={styles.button} disabled={busy}
            accessibilityRole="button" onPress={()=>void read(item.notificationRef)}>
            <Text>Mark as read</Text>
          </Pressable>}
        </View>)}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>My recorded mobile verification</Text>
      {!mobileProof?<Text style={styles.muted}>
        Current contact verification status is unavailable. Existing notices remain accessible.
      </Text>:mobileProof.verified?<Text style={styles.muted}>
        Verified CareGanga contact: {mobileProof.maskedContact}.
        SMS still requires purpose-specific consent and a sending provider.
      </Text>:!mobileProof.hasNumber?<Text style={styles.muted}>
        No mobile contact is recorded for your account. Ask an authorized
        Foundation administrator to update the original account first.
      </Text>:<>
        <Text style={styles.muted}>Recorded contact: {mobileProof.maskedContact}.
          Verify the original account number; no new phone is collected here.</Text>
        <Pressable style={styles.button} accessibilityRole="button"
          disabled={busy||mobileBusy||!mobileProof.providerConfigured}
          onPress={()=>void startMobileProof()}>
          <Text>{mobileProof.providerConfigured?
            "Request SMS verification code":"Verification provider unavailable"}</Text>
        </Pressable>
        <TextInput style={styles.input} value={mobileCode}
          onChangeText={x=>setMobileCode(x.replace(/[^0-9]/g,""))}
          keyboardType="number-pad" maxLength={10}
          accessibilityLabel="SMS verification code"
          placeholder="Code received on recorded mobile"/>
        <Pressable style={styles.button} accessibilityRole="button"
          disabled={busy||mobileBusy||!/^\d{4,10}$/.test(mobileCode)}
          onPress={()=>void confirmMobileProof()}>
          <Text>Verify recorded mobile</Text>
        </Pressable>
      </>}
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>Verified delivery preferences</Text>
      <Text style={styles.muted}>In-app notices remain available independently.
        Email and SMS require a verified contact, your consent and an available
        approved sending provider. A queued message is not a delivered message.</Text>
      {prefs&&(["EMAIL","SMS"] as const).map(channel=>
        (["TRANSACTIONAL","PROMOTIONAL"] as const).map(purpose=>{
          const available=channel==="EMAIL"?prefs.available.email:prefs.available.sms;
          const current=prefs.preferences.find(x=>x.channel===channel&&x.purpose===purpose);
          return <Pressable key={channel+purpose} accessibilityRole="button"
            accessibilityState={{disabled:!available||busy,checked:!!current?.opted_in}}
            disabled={!available||busy} style={styles.option}
            onPress={()=>void preference(channel,purpose)}>
            <Text>{channel} · {purpose.toLowerCase()}</Text>
            <Text style={styles.muted}>{!available?
              "Contact not verified":current?.opted_in?"Opted in":"Not opted in"}</Text>
          </Pressable>;
        }))}
    </View>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:theme.adminCanvas},
  content:{padding:18,paddingBottom:96,gap:14,width:"100%",maxWidth:760,alignSelf:"center"},
  row:{flexDirection:"row",alignItems:"center",gap:10},
  title:{fontSize:22,fontWeight:"700",color:theme.text,flex:1},
  heading:{fontWeight:"700",fontSize:16,color:theme.text},
  muted:{color:theme.mutedText,fontSize:13},
  error:{color:theme.error,padding:11,backgroundColor:theme.surface,borderRadius:8},
  card:{backgroundColor:theme.surface,borderColor:theme.border,borderWidth:1,
    borderRadius:14,padding:15,gap:10,
    shadowColor:theme.sidebar,shadowOpacity:0.045,
    shadowOffset:{width:0,height:2},shadowRadius:8,elevation:1},
  item:{padding:13,borderWidth:1,borderColor:theme.border,borderRadius:12,gap:8},
  button:{minHeight:48,justifyContent:"center",padding:12,
    borderWidth:1,borderRadius:12,borderColor:theme.border},
  option:{padding:12,borderWidth:1,borderColor:theme.border,borderRadius:12,minHeight:56},
  input:{minHeight:48,color:theme.text,backgroundColor:theme.surface,
    borderWidth:1,borderColor:theme.border,borderRadius:10,padding:10}
});
