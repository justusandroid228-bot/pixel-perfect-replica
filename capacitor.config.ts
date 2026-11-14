import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.justus.messenger",
  appName: "Just Us",
  webDir: "dist",
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 3000, launchAutoHide: false, backgroundColor: "#FFF0F5", showSpinner: false },
    StatusBar: { backgroundColor: "#FFF0F5", style: "LIGHT", overlaysWebView: false },
    Keyboard: { resize: "native" },
  },
};

export default config;
