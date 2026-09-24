import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { useEffect } from "react";
import { ImageBackground, StyleSheet, View } from "react-native";
import { auth } from "../src/firebase";

export default function Splash() {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      if (auth?.currentUser) {
        router.replace("/(tabs)");
      } else {
        router.replace("/auth/login");
      }
    }, 2000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <ImageBackground
        source={require("../assets/images/splash-image.png")}
        style={styles.splashImage}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080614",
  },
  splashImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
