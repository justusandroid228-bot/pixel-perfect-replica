# JustUs roadmap

- [x] Backend: tables, rules, private media storage
- [x] Auth screens, splash, privacy notice
- [x] Pairing screen (create room, share/copy/revoke code, join code)
- [x] Chat (text, photos, videos, voice, stickers, typing, receipts, unread, offline/retry, pagination)
- [x] Settings (name, notification prefs, typing privacy, privacy notice, log out)
- [x] Android wrapper (Capacitor config, bundled web build, permissions, status bar, splash, back button)
- [x] GitHub Actions: debug APK + signed release APK workflows
- [x] Tests: unit rules
- [x] Tests: database security scenarios (third account, revoked code, full room, non-member reads, expired code — verified live 2026-11-12)
- [x] GitHub debug APK produced and download shared
- [x] Harden signed release workflow and verify signing failure/success handling (automated contract tests; actual signed APK requires repository secrets)
- [x] Browser-only keystore creation workflow
- [ ] Blocked on user: add 3 password secrets + SECRETS_WRITE_TOKEN, run keystore workflow, then release workflow
