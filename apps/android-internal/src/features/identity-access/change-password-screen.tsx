import {useState} from "react";
import {KeyboardAvoidingView,Platform,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {identityRequest} from "./http-client";
import {careGangaTheme as cg} from "../../../../../packages/design-tokens/src/index";

export function ChangePasswordScreen({token,onExit,onChanged,onExpired}:{
  token:string;onExit:()=>void;onChanged:()=>void;onExpired:()=>void;
}){
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirm,setConfirm]=useState("");
  const [visible,setVisible]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  async function change(){
    if(busy)return;
    if(newPassword.length<8||newPassword!==confirm||newPassword===currentPassword){
      setMessage("Choose a new password of at least eight characters and confirm it.");return;
    }
    setBusy(true);setMessage("");
    try{
      const response=await identityRequest("/api/identity/password/change",{
        method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},
        body:JSON.stringify({currentPassword,newPassword})
      });
      if(response.status===401){onExpired();return;}
      if(!response.ok){setMessage(response.status===403?
        "Current password could not be confirmed.":"Password change could not be confirmed.");return;}
      setCurrentPassword("");setNewPassword("");setConfirm("");
      onChanged();
    }catch{setMessage("The outcome is uncertain. Check whether your new password works before retrying.");}
    finally{setBusy(false);}
  }
  return <SafeAreaView style={styles.root}><KeyboardAvoidingView
    behavior={Platform.OS==="ios"?"padding":undefined} style={styles.root}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={styles.title}>Change password</Text>
      <Text style={styles.helper}>All existing sessions will be signed out when your password changes.</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Current password</Text>
        <TextInput accessibilityLabel="Current password" style={styles.input}
          autoComplete="current-password" secureTextEntry={!visible}
          value={currentPassword} onChangeText={setCurrentPassword}/>
        <Text style={styles.label}>New password</Text>
        <TextInput accessibilityLabel="New password" style={styles.input} maxLength={1024}
          autoComplete="new-password" secureTextEntry={!visible}
          value={newPassword} onChangeText={setNewPassword}/>
        <Text style={styles.label}>Confirm new password</Text>
        <TextInput accessibilityLabel="Confirm new password" style={styles.input}
          autoComplete="new-password" secureTextEntry={!visible}
          value={confirm} onChangeText={setConfirm}/>
        <Pressable accessibilityRole="button" onPress={()=>setVisible(x=>!x)} style={styles.button}>
          <Text style={styles.label}>{visible?"Hide":"Show"} passwords</Text>
        </Pressable>
        {!!message&&<Text accessibilityRole="alert" style={styles.helper}>{message}</Text>}
        <Pressable accessibilityRole="button" onPress={()=>void change()}
          disabled={busy||newPassword.length<8||newPassword!==confirm}
          style={[styles.button,styles.primary]}>
          <Text style={styles.primaryText}>{busy?"Changing…":"Change password"}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onExit} disabled={busy} style={styles.button}>
          <Text>Cancel</Text>
        </Pressable>
      </View>
    </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:cg.background},
  content:{padding:24,gap:12,width:"100%",maxWidth:680,alignSelf:"center"},
  title:{fontSize:25,fontWeight:"700",color:cg.text},
  helper:{fontSize:14,color:cg.mutedText},
  card:{padding:18,gap:12,borderRadius:12,backgroundColor:cg.surface,borderWidth:1,borderColor:cg.border},
  label:{color:cg.text,fontWeight:"600"},
  input:{minHeight:48,paddingHorizontal:12,borderWidth:1,borderRadius:7,
    borderColor:cg.border,color:cg.text,backgroundColor:cg.surface},
  button:{minHeight:48,alignItems:"center",justifyContent:"center",borderWidth:1,
    borderRadius:8,borderColor:cg.border,padding:12},
  primary:{backgroundColor:cg.primary,borderColor:cg.primary},
  primaryText:{color:cg.primaryText,fontWeight:"700"}
});
