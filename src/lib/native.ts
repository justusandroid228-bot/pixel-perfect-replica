/** Android-only startup: status bar colour, hide splash, hardware back button. No-op on the web. */
export async function initNative(goBack: () => void) {
  const { Capacitor } = await import("@capacitor/core");
  if (!Capacitor.isNativePlatform()) return;
  const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/splash-screen"),
    import("@capacitor/app"),
  ]);
  StatusBar.setStyle({ style: Style.Light }).catch(() => {});
  StatusBar.setBackgroundColor({ color: "#FFF0F5" }).catch(() => {});
  SplashScreen.hide().catch(() => {});
  App.addListener("backButton", ({ canGoBack }) => {
    if (canGoBack) goBack();
    else App.minimizeApp();
  });
}
