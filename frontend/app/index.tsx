import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Image, StyleSheet, View } from "react-native";
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
      <Image
        source={require("../assets/images/splash-image.png")}
        style={styles.splashImage}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080614",
    alignItems: "center",
    justifyContent: "center",
  },
  splashImage: {
    width: "100%",
    height: "100%",
  },
});
