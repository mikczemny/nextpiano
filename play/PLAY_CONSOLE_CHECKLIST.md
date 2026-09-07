# Next Piano 2.0 — release checklist

Release package: com.mikczemny.nextpiano. Version 2.0.0, versionCode 20000. API 26 minimum, compile/target 36. Preview (.preview) is a separate testing app and MUST NOT be uploaded as the existing production app.

1. Run build, lint, MIDI unit tests and emulator tests. Review warnings and test reports.
2. Perform the physical USB MIDI/audio/latency acceptance checks in TEST_PLAN.md. Automated tests do not certify a specific instrument.
3. Reuse the existing Next Piano upload key. Keep keystore and credentials outside Git; confirm certificate against the app already registered in Play Console. CI outputs are unsigned.
4. Upload the signed release AAB to internal testing before production. A directly installed APK may have a different signing identity from the Google Play distributed application.
5. Update descriptions and real screenshots to match version 2.0. Do not claim sampled piano, microphone note recognition, BLE pairing, recording or UMP support.
6. Publish the updated privacy policy and configure a developer support email. Learning results/preferences now exist locally, unlike the original version; do not keep a blanket statement that the app stores nothing.
7. Complete Data safety from the actual app behavior: no internet transmission, analytics, ads, accounts or sensitive permissions; local-only preferences/results; explicit MIDI communication with the selected device. Recheck the merged manifest/dependency behavior.
8. Complete accurate content rating, chosen target audience and account-specific testing requirements shown in Play Console. No production approval or account eligibility is implied by a successful build.
9. Preserve the current application ID and ensure versionCode is higher than all versions already submitted. Review Play pre-launch reports before production rollout.

No Google Play submission is performed by this project or its CI workflow.
