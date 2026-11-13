
#!/usr/bin/env bash
set -euo pipefail

WEB_ENTRY="dist/client/index.html"

if [ ! -s "$WEB_ENTRY" ]; then
  echo "ERROR: Missing $WEB_ENTRY"
  echo "Mobile web build must run before Android setup."
  exit 1
fi

if [ ! -d android ]; then
  npx cap add android
fi

M="android/app/src/main/AndroidManifest.xml"

for p in RECORD_AUDIO CAMERA READ_MEDIA_IMAGES READ_MEDIA_VIDEO MODIFY_AUDIO_SETTINGS; do
  grep -q "android.permission.$p\"" "$M" || \
    sed -i "s#</manifest>#    <uses-permission android:name=\"android.permission.$p\" />\\n</manifest>#" "$M"
done

mkdir -p resources
cp public/icon-512.png resources/icon.png
cp public/icon-512.png resources/splash.png

npx @capacitor/assets generate --android --iconBackgroundColor '#FFF0F5' --splashBackgroundColor '#FFF0F5' || true

npx cap sync android
