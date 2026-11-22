import {useRef,useState} from "react";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import * as Crypto from "expo-crypto";
import {memberInvoke} from "./member-native-api";
type Login={sessionToken:string;expiresAt:string};
export function NativeCommunityAuth({onSignedIn}:{onSignedIn:(token:string)=>Promise<void>}){
 const [mode,setMode]=useState<"login"|"signup">("login"),[identifier,setIdentifier]=useState(""),[password,setPassword]=useState("");
 const [first,setFirst]=useState(""),[last,setLast]=useState(""),[mobile,setMobile]=useState(""),[email,setEmail]=useState(""),[signupPassword,setSignupPassword]=useState(""),[code,setCode]=useState("");
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const pending=useRef<{key:string;digest:string}|null>(null);
 const act=async(work:()=>Promise<void>)=>{if(busy)return;setBusy(true);setMessage("");try{await work();}catch(e){setMessage(e instanceof Error?e.message:"The result could not be confirmed. Check the existing account before retrying.");}finally{setBusy(false);}};
 const field=(label:string,value:string,set:(v:string)=>void,secure=false,keyboard:"default"|"email-address"|"phone-pad"|"number-pad"="default")=>
  <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} style={s.input} value={value} onChangeText={set} secureTextEntry={secure} keyboardType={keyboard} autoCapitalize="none"/></View>;
 const button=(title:string,fn:()=>void)=> <Pressable accessibilityRole="button" disabled={busy} onPress={fn} style={[s.button,busy&&{opacity:.45}]}><Text style={s.buttonText}>{title}</Text></Pressable>;
 const login=()=>void act(async()=>{
  const r=await memberInvoke<Login>("/api/identity/login","POST",{identifier,password,deviceLabel:"CareGanga Membership Android"});
  if(!r.sessionToken||!r.expiresAt||Date.parse(r.expiresAt)<=Date.now())throw new Error("Membership sign-in was not confirmed.");
  await onSignedIn(r.sessionToken);setPassword("");
 });
 const signup=()=>void act(async()=>{
  const data={firstName:first.trim(),lastName:last.trim(),mobile:mobile.trim(),email:email.trim()||null,password:signupPassword,code:code.trim()},digest=JSON.stringify(data);
  if(pending.current?.digest!==digest)pending.current={digest,key:Crypto.randomUUID()};
  const r=await memberInvoke<{status:string}>("/api/identity/community/register","POST",{requestKey:pending.current.key,...data});
  if(r.status!=="ACCOUNT_CREATED")throw new Error("Account registration could not be confirmed.");
  pending.current=null;setIdentifier(data.email||data.mobile);setPassword("");setSignupPassword("");setCode("");setMode("login");
  setMessage("Your verified CareGanga community account was created. Sign in to continue.");
 });
 return <View style={s.card}><Text accessibilityRole="header" style={s.title}>Membership account</Text>
 <View style={s.row}>{button("Sign in",()=>setMode("login"))}{button("Create account",()=>setMode("signup"))}</View>
 {!!message&&<Text accessibilityRole="alert">{message}</Text>}
 {mode==="login"?<>{field("Mobile or email",identifier,setIdentifier)}{field("Password",password,setPassword,true)}{button("Sign in to membership",login)}</>:
 <>{field("First name",first,setFirst)}{field("Last name",last,setLast)}{field("Indian mobile number",mobile,setMobile,false,"phone-pad")}{field("Email (optional)",email,setEmail,false,"email-address")}{field("Choose a password",signupPassword,setSignupPassword,true)}
 {button("Request mobile code",()=>void act(async()=>{await memberInvoke("/api/identity/community/start","POST",{mobile:mobile.trim()});setMessage("Verification code requested; delivery is not guaranteed.");}))}
 {field("Received verification code",code,setCode,false,"number-pad")}{button("Create verified account",signup)}</>}
 </View>;
}
const s=StyleSheet.create({card:{padding:16,gap:12,borderWidth:1,borderColor:"#d5e4df",borderRadius:14,backgroundColor:"white"},title:{fontSize:21,fontWeight:"700",color:"#174632"},field:{gap:5},label:{fontWeight:"600",color:"#244559"},input:{minHeight:48,borderWidth:1,borderColor:"#bdd0c7",padding:11,borderRadius:9,color:"#12324d"},row:{flexDirection:"row",gap:8,flexWrap:"wrap"},button:{borderWidth:1,borderColor:"#9bc2aa",borderRadius:9,padding:12,minHeight:46,justifyContent:"center"},buttonText:{color:"#174632",fontWeight:"700"}});
