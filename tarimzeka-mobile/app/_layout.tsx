import "react-native-gesture-handler";
import { DarkTheme, DefaultTheme, ThemeProvider as RNThemeProvider } from "@react-navigation/native";
import { Slot, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import * as SplashScreen from "expo-splash-screen";
import { ActivityIndicator, View } from "react-native";
import { useEffect } from "react";

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { token, isLoading } = useAuth();
  const { isDark, themeLoaded, colors } = useTheme();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    // Auth sayfaları: login ve register
    const inAuthPage =
      segments[0] === "login" ||
      segments[0] === "register" ||
      segments[0] === "forgot-password" ||
      segments[0] === "reset-password";

    console.log("🔄 Segment:", segments[0], "Token:", token, "InAuthPage:", inAuthPage);

    if (!token) {
      // Token yoksa ve auth sayfasında değilse login'e yönlendir
      if (!inAuthPage) {
        console.log("➡️ Redirecting to login");
        router.replace("/login");
      }
    } else {
      // Token varsa ve auth sayfasındaysa tabs'e yönlendir
      if (inAuthPage) {
        console.log("➡️ Redirecting to tabs");
        router.replace("/(tabs)");
      }
    }
  }, [token, isLoading, segments]);

  if (isLoading || !themeLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <RNThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Slot />
    </RNThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
