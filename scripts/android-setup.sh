#!/usr/bin/env bash
# Builds the bundled web app and generates/syncs the Android project. Used by CI and locally.
set -euo pipefail

mkdir -p dist
if [ ! -f "dist/index.html" ]; then
  npm run build || CAPACITOR=1 npx vite build
  INDEX_PATH=$(find . -name "index.html" -not -path "*/node_modules/*" -not -path "*/android/*" | head -n 1)
  if [ -n "$INDEX_PATH" ]; then
    WEB_DIR=$(dirname "$INDEX_PATH")
    cp -r "$WEB_DIR"/* dist/
  fi
fi

[ -d android ] || npx cap add android
M=android/app/src/main/AndroidManifest.xml
for p in RECORD_AUDIO CAMERA READ_MEDIA_IMAGES READ_MEDIA_VIDEO MODIFY_AUDIO_SETTINGS; do
  grep -q "android.permission.$p\"" "$M" || sed -i "s#</manifest>#    <uses-permission android:name=\"android.permission.$p\" />\n</manifest>#" "$M"
done
mkdir -p resources
cp public/icon-512.png resources/icon.png
cp public/icon-512.png resources/splash.png
npx @capacitor/assets generate --android --iconBackgroundColor '#FFF0F5' --splashBackgroundColor '#FFF0F5' || true
npx cap sync android
