# Release signing

Google Play requires a signed Android App Bundle. Keep the upload keystore private and backed up.

## Create the upload key once

```bash
keytool -genkeypair -v \
  -keystore nextpiano-upload-key.jks \
  -alias nextpiano-upload \
  -keyalg RSA -keysize 4096 -validity 10000
```

Do not add the `.jks` file or passwords to Git. The repository `.gitignore` excludes common keystore names.

## Sign an unsigned AAB

```bash
jarsigner -verbose \
  -sigalg SHA256withRSA \
  -digestalg SHA-256 \
  -keystore nextpiano-upload-key.jks \
  app-release.aab \
  nextpiano-upload
```

## Verify

```bash
jarsigner -verify -verbose -certs app-release.aab
```

For Play Console, enrol in Play App Signing. This upload key authenticates future uploads; Google Play manages the app-signing key used for distribution.
