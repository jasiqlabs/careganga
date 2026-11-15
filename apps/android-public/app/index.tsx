import { SafeAreaView } from "react-native-safe-area-context";
import { careGangaTheme } from "../../../../packages/design-tokens/src/index";
import { ScrollView, StyleSheet, Text, View } from "react-native";
export default function PublicHome() {
  return <SafeAreaView style={styles.page}><ScrollView contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={styles.title}>CareGanga Foundation</Text>
    <Text>Foundation operations and healthcare assistance.</Text>
    <View style={styles.gap}/>
    <Text>Public features will become available as their owning modules are delivered.</Text>
  </ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:careGangaTheme.background},
  content:{padding:24,gap:12,minHeight:"100%",width:"100%",maxWidth:720,alignSelf:"center"},
  title:{fontSize:25,fontWeight:"700",color:careGangaTheme.sidebar},
  gap:{height:12}
});
