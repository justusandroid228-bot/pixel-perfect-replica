#!/usr/bin/env python3
"""Build and verify a release APK without placing signing passwords in arguments."""
import base64
import binascii
import os
from pathlib import Path
import subprocess
import sys
import tempfile

SECRET_NAMES = (
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
)


def signing_material(environ):
    missing = [name for name in SECRET_NAMES if not environ.get(name)]
    if missing:
        raise ValueError("Missing GitHub repository secrets: " + ", ".join(missing))
    try:
        material = base64.b64decode("".join(environ[SECRET_NAMES[0]].split()), validate=True)
    except (ValueError, binascii.Error) as error:
        raise ValueError("ANDROID_KEYSTORE_BASE64 must contain a base64-encoded keystore.") from error
    if not material:
        raise ValueError("ANDROID_KEYSTORE_BASE64 decodes to an empty keystore.")
    return material


def build_release(root, environ):
    material = signing_material(environ)
    android = root / "android"
    sdk = environ.get("ANDROID_SDK_ROOT") or environ.get("ANDROID_HOME")
    if not sdk:
        raise ValueError("Android SDK location is not configured.")
    verifiers = list((Path(sdk) / "build-tools").glob("*/apksigner"))
    if not verifiers:
        raise ValueError("Android SDK build-tools must include apksigner.")
    verifier = max(verifiers, key=lambda p: tuple(int(part) if part.isdigit() else 0 for part in p.parent.name.split(".")))
    out = android / "app/build/outputs/apk/release"
    apk = out / "app-release.apk"
    unsigned = out / "app-release-unsigned.apk"
    # A previous local build must never be mistaken for this run's output.
    apk.unlink(missing_ok=True)
    unsigned.unlink(missing_ok=True)
    with tempfile.TemporaryDirectory(prefix="justus-signing-") as folder:
        keystore = Path(folder) / "release.keystore"
        keystore.write_bytes(material)
        keystore.chmod(0o600)
        signing_env = dict(environ)
        signing_env.pop("ANDROID_KEYSTORE_BASE64", None)
        subprocess.run([
            "keytool", "-list", "-keystore", str(keystore),
            "-storepass:env", "ANDROID_KEYSTORE_PASSWORD",
            "-alias", environ["ANDROID_KEY_ALIAS"],
        ], env=signing_env, check=True, stdout=subprocess.DEVNULL)
        gradle = android / "gradlew"
        gradle.chmod(gradle.stat().st_mode | 0o100)
        subprocess.run(["./gradlew", "--no-daemon", "assembleRelease"], cwd=android, env=signing_env, check=True)
        if not unsigned.is_file():
            raise ValueError("The release app-release-unsigned.apk was not produced; no artifact will be uploaded.")
        # Passwords are read by apksigner from the environment, never from arguments.
        subprocess.run([
            str(verifier), "sign", "--ks", str(keystore),
            "--ks-key-alias", environ["ANDROID_KEY_ALIAS"],
            "--ks-pass", "env:ANDROID_KEYSTORE_PASSWORD",
            "--key-pass", "env:ANDROID_KEY_PASSWORD",
            "--out", str(apk), str(unsigned),
        ], env=signing_env, check=True)
        if not apk.is_file():
            raise ValueError("The signed app-release.apk was not produced; no artifact will be uploaded.")
        subprocess.run([str(verifier), "verify", "--verbose", "--print-certs", str(apk)], check=True)
    print("Verified signed release APK: android/app/build/outputs/apk/release/app-release.apk")


if __name__ == "__main__":
    try:
        if "--check-secrets" in sys.argv:
            signing_material(os.environ)
            print("All four signing secrets are present and the keystore encoding is valid.")
        else:
            build_release(Path(__file__).resolve().parent.parent, os.environ)
    except (ValueError, OSError, subprocess.CalledProcessError):
        # External command failures already report their cause; never print environments or secret values.
        if "--check-secrets" in sys.argv:
            print("Signing secrets are missing or the keystore encoding is invalid. See README for the four required names.", file=sys.stderr)
        else:
            print("Release signing or APK verification failed; no release artifact should be uploaded.", file=sys.stderr)
        sys.exit(1)