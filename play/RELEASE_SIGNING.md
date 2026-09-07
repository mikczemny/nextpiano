# Next Piano 2.0 signing

For the existing Next Piano app, REUSE its existing private upload keystore and alias. Do not generate a new key simply because this is a major version. Never store signing keys or passwords in Git or CI artifacts.

CI produces an unsigned release AAB and APK, plus a separately identified debug-signed Preview APK. The Preview can be installed alongside 1.0 without replacing it.

Use Android Studio's Generate Signed Bundle/APK with the existing keystore, or JDK jarsigner for the AAB:

```sh
jarsigner -keystore /private/path/existing-upload-key.jks -sigalg SHA256withRSA -digestalg SHA-256 NextPiano-2.0.0-unsigned.aab EXISTING_ALIAS
jarsigner -verify -verbose -certs NextPiano-2.0.0-unsigned.aab
```

The tool prompts for the password; do not put it in the command line. Rename only after signature verification. Use Android build-tools apksigner (not jarsigner) for direct-install APK signing and verification.

Google Play App Signing may use a distribution certificate different from the upload certificate. An upload-key-signed APK cannot necessarily update a Play-installed copy. Keep the private key and password in your own secure backup. The normal release download should NOT contain these secrets.
