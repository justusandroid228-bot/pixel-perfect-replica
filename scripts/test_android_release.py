"""Release signing contract tests; no real signing credentials are used."""
import base64
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("android_release", Path(__file__).with_name("android-release.py"))
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseSigningTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.android = self.root / "android"
        self.android.mkdir()
        (self.android / "gradlew").write_text("placeholder")
        self.apk = self.android / "app/build/outputs/apk/release/app-release.apk"
        self.apk.parent.mkdir(parents=True)
        sdk = self.root / "sdk"
        verifier = sdk / "build-tools/36.0.0/apksigner"
        verifier.parent.mkdir(parents=True)
        verifier.touch()
        self.env = dict(zip(release.SECRET_NAMES, [base64.b64encode(b"test-keystore").decode(), "test-store-password", "test-alias", "test-key-password"]))
        self.env["ANDROID_HOME"] = str(sdk)
        self.keystore = None

    def fake_command(self, args, **kwargs):
        if args[0] == "keytool":
            self.keystore = Path(args[args.index("-keystore") + 1])
            self.assertEqual(self.keystore.stat().st_mode & 0o777, 0o600)
            self.assertEqual(self.keystore.parent.stat().st_mode & 0o777, 0o700)
            self.assertEqual(self.keystore.read_bytes(), b"test-keystore")
        if args[0] == "./gradlew":
            self.apk.with_name("app-release-unsigned.apk").write_bytes(b"unsigned")
        if "sign" in args:
            self.assertIn("env:ANDROID_KEY_PASSWORD", args)
            Path(args[args.index("--out") + 1]).write_bytes(b"test-apk")
        for secret in (self.env["ANDROID_KEYSTORE_PASSWORD"], self.env["ANDROID_KEY_PASSWORD"]):
            self.assertNotIn(secret, args)
        return subprocess.CompletedProcess(args, 0)

    def test_each_of_four_secrets_is_required(self):
        for name in release.SECRET_NAMES:
            with self.subTest(name=name):
                env = dict(self.env)
                del env[name]
                with self.assertRaises(ValueError):
                    release.signing_material(env)

    def test_invalid_base64_is_rejected(self):
        self.env["ANDROID_KEYSTORE_BASE64"] = "not base64!"
        with self.assertRaises(ValueError):
            release.signing_material(self.env)

    def test_success_verifies_output_and_removes_keystore(self):
        with patch.object(release.subprocess, "run", side_effect=self.fake_command) as run:
            release.build_release(self.root, self.env)
        self.assertTrue(self.apk.is_file())
        self.assertEqual(Path(run.call_args.args[0][0]).name, "apksigner")
        self.assertIn("verify", run.call_args.args[0])
        self.assertFalse(self.keystore.exists())
        sign_env = run.call_args_list[2].kwargs["env"]
        self.assertEqual(sign_env["ANDROID_KEY_PASSWORD"], "test-key-password")
        self.assertNotIn("ANDROID_KEYSTORE_BASE64", sign_env)

    def test_failure_at_each_command_removes_keystore(self):
        for failing_step in ("keytool", "gradlew", "apksigner"):  # apksigner covers sign
            with self.subTest(step=failing_step):
                def command(args, **kwargs):
                    self.fake_command(args, **kwargs)
                    if Path(args[0]).name == failing_step:
                        raise subprocess.CalledProcessError(1, args)
                    return subprocess.CompletedProcess(args, 0)
                with patch.object(release.subprocess, "run", side_effect=command):
                    with self.assertRaises(subprocess.CalledProcessError):
                        release.build_release(self.root, self.env)
                self.assertFalse(self.keystore.exists())

    def test_missing_new_apk_rejects_stale_output(self):
        self.apk.write_bytes(b"old-apk")
        def command(args, **kwargs):
            if args[0] == "keytool":
                self.fake_command(args, **kwargs)
            return subprocess.CompletedProcess(args, 0)
        with patch.object(release.subprocess, "run", side_effect=command) as run:
            with self.assertRaises(ValueError):
                release.build_release(self.root, self.env)
        self.assertFalse(self.apk.exists())
        self.assertEqual(run.call_count, 2)
        self.assertFalse(self.keystore.exists())


if __name__ == "__main__":
    unittest.main()