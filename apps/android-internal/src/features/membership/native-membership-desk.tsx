import React,{useState} from "react";
import {Pressable,StyleSheet,Text,View} from "react-native";
import {careGangaTheme as theme} from "../../../../../packages/design-tokens/src/index";
import {NativeMemberRoster} from "./native-member-roster";
import {NativeMemberReview} from "./native-member-review";
import {NativeMemberDocuments} from "./native-member-documents";

export function NativeMembershipDesk({token,canViewMembers,canExportMembers,canReview,canConfigure,canIssueDocs,onExpired}:{
 token:string;canViewMembers:boolean;canExportMembers:boolean;canReview:boolean;canConfigure:boolean;canIssueDocs:boolean;onExpired:()=>void
}){
 const [tab,setTab]=useState<"members"|"reviews">(canViewMembers||canIssueDocs?"members":"reviews");
 const choice=(id:"members"|"reviews",label:string)=>(
  <Pressable accessibilityRole="tab" accessibilityState={{selected:tab===id}} key={id} onPress={()=>setTab(id)} style={[styles.tab,tab===id&&styles.selected]}>
   <Text style={[styles.label,tab===id&&styles.selectedLabel]}>{label}</Text>
  </Pressable>
 );
 const visible=tab==="members"&&(canViewMembers||canIssueDocs)?"members":canReview?"reviews":"members";
 return <View style={styles.container}>
  {(canViewMembers||canIssueDocs)&&canReview&&<View accessibilityRole="tablist" style={styles.tabs}>{choice("members","Member directory")}{choice("reviews","Application reviews")}</View>}
  <View style={styles.content}>{visible==="members"&&(canViewMembers||canIssueDocs)?
   canViewMembers?<NativeMemberRoster token={token} canExport={canExportMembers} canIssueDocs={canIssueDocs} onExpired={onExpired}/>:<NativeMemberDocuments token={token} onExpired={onExpired}/>:
   canReview?<NativeMemberReview token={token} canConfigure={canConfigure} onExpired={onExpired}/>:null}</View>
 </View>;
}
const styles=StyleSheet.create({
 container:{flex:1,backgroundColor:theme.adminCanvas},
 content:{flex:1},
 tabs:{flexDirection:"row",gap:8,paddingHorizontal:16,paddingVertical:10},
 tab:{flex:1,padding:12,borderWidth:1,borderColor:theme.border,borderRadius:10,backgroundColor:theme.surface},
 selected:{backgroundColor:theme.primary,borderColor:theme.primary},
 label:{fontWeight:"700",fontSize:13,color:theme.text,textAlign:"center"},
 selectedLabel:{color:theme.primaryText}
});
