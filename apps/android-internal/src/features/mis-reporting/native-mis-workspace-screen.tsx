import {Pressable,ScrollView,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as t} from "../../../../../packages/design-tokens/src/index";
import {NativeMisDashboard} from "./native-mis-dashboard";
import {NativeMisReports} from "./native-mis-reports";

/** Dedicated native match of Admin Web /admin/mis.
 * CG20 private MIS is staff-only; Public Android must never embed this screen.
 * Navigation, role and scope are rechecked by the SAME CG20 source endpoints.
 */
export function NativeMisWorkspaceScreen({token,onExpired,onExit,
 canDashboard,canReports,onOpenFinance,onOpenPatientAdmin}:{
 token:string;onExpired:()=>void;onExit:()=>void;
 canDashboard:boolean;canReports:boolean;
 onOpenFinance?:()=>void;onOpenPatientAdmin?:()=>void
}){
 return <ScrollView keyboardShouldPersistTaps="handled"
  contentContainerStyle={styles.content}
  accessibilityLabel="Foundation Reports and Management Information System">
  <View style={styles.header}>
   <Pressable accessibilityRole="button" accessibilityLabel="Back to dashboard"
    onPress={onExit} style={styles.back}>
    <Text style={styles.backText}>‹ Back</Text>
   </Pressable>
   <View style={{flex:1}}>
    <Text accessibilityRole="header" style={styles.title}>Reports &amp; MIS</Text>
    <Text style={styles.subtitle}>Verified Foundation business records</Text>
   </View>
  </View>
  {canDashboard&&<NativeMisDashboard token={token} onExpired={onExpired}
   onOpenFinance={onOpenFinance} onOpenPatientAdmin={onOpenPatientAdmin}/>}
  {canReports&&<NativeMisReports token={token} onExpired={onExpired}/>}
  {!canDashboard&&!canReports&&<Text accessibilityRole="alert"
   style={styles.error}>Your current role cannot access Foundation reporting.</Text>}
 </ScrollView>;
}
const styles=StyleSheet.create({
 content:{flexGrow:1,paddingBottom:120,backgroundColor:t.adminCanvas},
 header:{flexDirection:"row",alignItems:"center",gap:12,padding:16,
  borderBottomWidth:1,borderBottomColor:t.border,backgroundColor:t.surface},
 back:{minWidth:64,minHeight:48,justifyContent:"center"},
 backText:{color:t.primary,fontSize:15,fontWeight:"700"},
 title:{fontSize:20,fontWeight:"800",color:t.text},
 subtitle:{fontSize:12,color:t.mutedText,marginTop:4},
 error:{color:t.error,fontSize:13,padding:16}
});
