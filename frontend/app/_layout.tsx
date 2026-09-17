import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { LogBox, Text, TouchableOpacity, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { DesktopShell } from "@/src/components/DesktopShell";
import { useAuthState } from "@/src/services/authService";
import { SecurityProvider, useSecurity } from "@/src/contexts/SecurityContext";
import LockScreen from "@/src/components/LockScreen";
import PrivacyScreen from "@/src/components/PrivacyScreen";

// Disable logbox errors so users can see the app
LogBox.ignoreAllLogs(true);

// Keep native splash visible until fonts are ready
SplashScreen.preventAutoHideAsync().catch(() => {});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("App Render Error Caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: "#0F172A",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text style={{ color: "#F8FAFC", fontSize: 20, fontWeight: "700", marginBottom: 12 }}>
            Something went wrong
          </Text>
          <Text
            style={{
              color: "#94A3B8",
              fontSize: 14,
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            {this.state.error?.message || "An unexpected rendering error occurred."}
          </Text>
          <TouchableOpacity
            onPress={() => this.setState({ hasError: false, error: null })}
            style={{
              backgroundColor: "#06B6D4",
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 24,
            }}
          >
            <Text style={{ color: "#0F172A", fontWeight: "700" }}>Reload App</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}


function RootLayoutContent() {
  const { isLocked } = useSecurity();

  return (
    <>
      <DesktopShell>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0F172A" },
            animation: "fade",
          }}
        />
      </DesktopShell>
      {isLocked && <LockScreen />}
      <PrivacyScreen />
    </>
  );
}

export default function RootLayout() {
  useIconFonts();
  const { user, loading: authLoading } = useAuthState();
  const segments = useSegments();
  const router = useRouter();

  // Hide splash screen immediately on mount
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Auth guard — runs whenever auth state or route changes
  useEffect(() => {
    if (authLoading) return;

    const currentSegment = (segments[0] as string) || "";
    const isPublic = ["auth", "w", "create-profile", "index", "onboarding", ""].includes(
      currentSegment
    );

    if (!user && !isPublic) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, segments]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0F172A" }}>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: "#0F172A" }}>
          <StatusBar style="light" />
          <SecurityProvider>
            <RootLayoutContent />
          </SecurityProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
