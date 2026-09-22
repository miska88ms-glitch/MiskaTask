import { View } from "react-native";

// Routing is handled by the root-layout Gate. This screen only shows a blank
// canvas while the Gate decides where to send the user.
export default function Index() {
  return <View style={{ flex: 1, backgroundColor: "#FFF9F6" }} testID="index-splash" />;
}
