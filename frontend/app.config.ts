import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Private Voices",
  slug: "privatevoices",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "privatevoices",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.privatevoices",
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#000000",
    },
    edgeToEdgeEnabled: true,
    package: "com.privatevoices",
    googleServicesFile: "./google-services.json",
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-image.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0F172A",
      },
    ],
    [
      "expo-local-authentication",
      {
        faceIDPermission:
          "Allow Private Voices to use Face ID to protect your private messages and account.",
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    eas: { projectId: "61928545-173c-44a9-82ae-34905cd4ab57" },
  },
});
