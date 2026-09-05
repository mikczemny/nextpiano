# Google Play submission checklist

## Build
- Package: `com.mikczemny.nextpiano`
- Version: `1.0.0` (`versionCode 1`)
- `compileSdk 36`
- `targetSdk 36`
- `minSdk 26`
- Release format: Android App Bundle (`.aab`)
- 64-bit requirement: satisfied automatically; app contains no native libraries

## Permissions and privacy
- INTERNET permission: not requested
- Accounts: none
- Ads: none
- Analytics: none
- Personal data collection: none
- Data sharing: none
- Location: none
- Camera/microphone: none
- Files/photos: none

### Suggested Data safety answers
- Does your app collect or share any of the required user data types? **No**
- Is all user data encrypted in transit? **Not applicable — no user data is transmitted**
- Can users request that data be deleted? **Not applicable — no user data is collected**

## Content
- Suggested audience: 13+ / general audience unless you intentionally decide to target children
- Contains ads: No
- App access: All functionality available without login
- Content rating: educational/music application; no violence, sex, gambling, controlled substances or user-generated content

## Store listing assets still required in Play Console
- 512 × 512 px app icon
- at least 2 phone/tablet screenshots
- 1024 × 500 px feature graphic if required for the selected listing surface
- developer contact email
- public privacy-policy URL

## Publishing sequence
1. Create the app in Play Console with package `com.mikczemny.nextpiano`.
2. Enrol in Play App Signing.
3. Create and safely retain one upload keystore; never commit it to Git.
4. Sign the release AAB with the upload key.
5. Upload the signed AAB to Internal testing first.
6. Complete App content, Data safety, Content rating and Store listing.
7. If the developer account is a personal account created after 13 Nov 2023, run Closed testing with at least 12 opted-in testers continuously for 14 days before applying for production access.
8. Promote the tested build to Production after Play Console review/eligibility.
