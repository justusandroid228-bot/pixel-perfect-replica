# Pixel Perfect Replica

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c14947eb-a778-47c5-851e-cfad7595353c).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Signed Android release APK

### Android build output

`npm run build` creates the bundled Android app directly in `dist/`, including the generated `dist/index.html` and its compiled assets. Capacitor's `webDir` is `dist`; neither workflow rewrites that setting or copies a source HTML file as a fallback.

```sh
bun install --frozen-lockfile
npm run build
bash scripts/android-setup.sh
# For an existing Android project after later web changes:
npx cap sync android
```

The setup script creates the Android platform if needed, adds permissions and app artwork, then syncs the complete bundle. Both debug and signed release workflows use these same steps and stop if the generated entry is missing. Use `npm run build:web` for the hosted web/Worker build, not the Android bundle.

In GitHub, open this repository → **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret | Value |
| --- | --- |
| `ANDROID_KEYSTORE_BASE64` | Base64 encoding of your existing release `.jks` or `.keystore` file (not its path). |
| `ANDROID_KEYSTORE_PASSWORD` | Keystore password. |
| `ANDROID_KEY_ALIAS` | Signing key alias inside that keystore. |
| `ANDROID_KEY_PASSWORD` | Signing key password (may match the keystore password). |

Use **repository secrets in GitHub**, not Lovable project secrets. Do not paste keys or passwords into chat, commit them, or put them in workflow commands. Keep an encrypted backup of the original keystore and passwords: future updates must use the same signing key. A release APK cannot update an installed debug APK signed with a different key; uninstalling the debug app first removes its local data.

Encode an existing keystore locally into a temporary file, copy its contents into `ANDROID_KEYSTORE_BASE64`, then delete the temporary file:

```sh
# Linux / macOS (run outside the repository)
base64 < /path/to/release.jks | tr -d '\n' > /tmp/release-keystore.base64
```

```powershell
# Windows PowerShell (run outside the repository)
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\secure\release.jks')) | Set-Content "$env:TEMP\release-keystore.base64" -NoNewline
```

If this is the first release and you have no keystore, create one locally with the Java JDK's interactive prompts (never include passwords as command arguments):

```sh
keytool -genkeypair -v -keystore /secure/path/justus-release.jks -storetype JKS -alias justus -keyalg RSA -keysize 3072 -validity 10000
```

Open **Actions → Android signed release APK → Run workflow**, select the branch containing this workflow, then run it. Download **justus-release-apk** from the successful run's **Artifacts**, unzip it, and install `app-release.apk`. The workflow builds the bundled app, validates the keystore alias, signs the APK, and verifies its signature before uploading. Missing secrets, invalid signing credentials, missing APK output, or verification failure stop the run. The keystore is stored only in a restricted temporary directory and removed when signing finishes, including on failure; only the verified APK is uploaded.
