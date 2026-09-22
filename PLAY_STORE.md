# Play Store Deployment Guide

Everything needed to put CrewDay on Google Play, and what is already done.

---

## 1. Release keystore — DONE (22 Sep 2026)

The upload key exists and the project is wired to it:

| What | Where |
| --- | --- |
| Keystore | `C:\Users\shaly\keys\crewday-upload.jks` (alias `crewday`) |
| Passwords | `C:\Users\shaly\keys\crewday-upload-PASSWORD.txt` |
| Gradle config | `android/keystore.properties` (gitignored) |

**Back up the `.jks` and the password file somewhere outside this machine
now** (password manager, encrypted drive). Google cannot recover them; without
them the app can never be updated on Play again.

To create a fresh one on another machine:

```bash
keytool -genkeypair -v -keystore crewday-upload.jks -alias crewday -keyalg RSA -keysize 2048 -validity 10000
```

then copy `android/keystore.properties.example` to `android/keystore.properties`
and fill in the path and passwords (absolute path, forward slashes).

## 2. Build the App Bundle

```bash
npm run android:bundle          # -> android/app/build/outputs/bundle/release/app-release.aab
npm run android:apk:release     # -> android/app/build/outputs/apk/release/app-release.apk (same signing, for side-loading)
npm run android:apk             # -> android/app/build/outputs/apk/debug/app-debug.apk
```

Each command rebuilds the web app, syncs it into `android/`, and compiles.
Gradle needs Android Studio's bundled JDK:
`JAVA_HOME=C:\Program Files\Android\Android Studio\jbr`.

Before **every** upload raise `versionCode` in `android/app/build.gradle` by
one (Play rejects a code it has seen). `versionName` is what people read.

## 3. Google sign-in certificates

Firebase only trusts signing certificates it knows. Registered on the Firebase
Android app `1:695634314665:android:e015bc44d3f555d1caf0b8`:

| Key | SHA-1 | Status |
| --- | --- | --- |
| Debug (`~/.android/debug.keystore`) | `51:9F:F1:4A:0B:F5:E6:56:24:74:A3:3D:D8:A0:0D:41:CB:38:C5:59` | registered |
| Upload (`crewday-upload.jks`) | `A3:65:AF:77:7A:8F:9B:2B:94:5D:63:28:32:C5:D2:38:0F:BE:EB:2F` | registered |
| Play App Signing | shown in Play Console -> Setup -> App signing after the first upload | **TODO** |

Play re-signs the bundle with its own key, so Google sign-in in the store
build fails with error code 10 until that third SHA-1 is added:

```bash
firebase apps:android:sha:create 1:695634314665:android:e015bc44d3f555d1caf0b8 <PLAY_APP_SIGNING_SHA1>
firebase apps:sdkconfig ANDROID 1:695634314665:android:e015bc44d3f555d1caf0b8 > android/app/google-services.json
npm run android:bundle   # rebuild and upload again
```

## 4. Policy requirements — what the app provides

| Play requirement | Where it is satisfied |
| --- | --- |
| Privacy policy URL (store listing + Data safety) | `https://crewday-2657d.web.app/privacy` |
| Terms of service | `https://crewday-2657d.web.app/terms` |
| Account deletion in-app (User Data policy) | Profile -> Settings -> Danger zone -> Delete account |
| Account deletion web URL (Data safety form) | `https://crewday-2657d.web.app/delete-account` |
| Support email | `SUPPORT_EMAIL` in `src/utils/constants.ts` (shown on the pages above) |
| Target API level | targetSdk 36 |
| Permissions | `INTERNET`, `CAMERA` (organiser QR check-in only; `required=false`) |

The three URLs only work once the website is deployed with the current build:

```bash
npm run deploy:hosting
```

If the site lives on another domain (Vercel), use that domain instead and
update `APP_URL` for the Cloud Functions.

### What deletion does (say this in the Data safety form)

- Deletes the sign-in (email/password or Google link).
- Removes name, email, phone, photo, city, area, interests, notification
  settings and device tokens from the profile.
- Blanks name/email/phone on every registration and waitlist entry the account
  ever made; upcoming registrations are cancelled and seats released.
- Keeps an anonymous attendance count per event and Razorpay order/payment ids
  (legal retention). No personal data remains.

## 5. Data safety form answers

| Question | Answer |
| --- | --- |
| Does the app collect or share user data? | Collects: yes. Shares: no (Firebase and Razorpay are processors, not third-party sharing). |
| Encrypted in transit? | Yes |
| Can users request deletion? | Yes — in-app and via the URL above |
| **Personal info** | Name, email address, phone number, user ids — required, for app functionality and account management |
| **Photos** | Profile photo — optional, app functionality |
| **Location** | Approximate location (typed city/area, not device location) — optional, personalisation |
| **Financial info** | Purchase history (Razorpay order/payment ids and amounts) — app functionality. Card/UPI details are never collected by the app. |
| **App activity** | App interactions (anonymous analytics events) — analytics |
| **Device or other ids** | Push notification tokens — app functionality |
| Camera | Not collected (used live for QR scanning by organisers; nothing stored) |

## 6. Store listing checklist

- [ ] App name: CrewDay. Short description (80 chars) and full description.
- [ ] Icon 512×512 PNG (`assets/` has the source; `npm run android:assets` regenerates launcher icons).
- [ ] Feature graphic 1024×500.
- [ ] At least 2 phone screenshots (take them from the release APK).
- [ ] Category: Events (or Social). Contact email = `SUPPORT_EMAIL`.
- [ ] Privacy policy URL from section 4.
- [ ] Content rating questionnaire: no user-generated public content beyond
      event requests reviewed by organisers; no gambling; user interaction: yes.
- [ ] Target audience: 18+ (terms require 18 or guardian permission).
- [ ] Data safety: section 5.
- [ ] App access: provide a test account (email/password) for Google's review
      so the reviewer can get past sign-in.
- [ ] Ads: none.

## 7. Upload

1. Play Console -> your app -> **Testing -> Internal testing** first (fast
   review, lets you install the Play-signed build and check Google sign-in
   after step 3).
2. Upload `app-release.aab`, add release notes, roll out.
3. Copy the App Signing SHA-1 into Firebase (section 3), rebuild, upload again.
4. Promote to **Production** once the internal build works end to end,
   including a paid registration (needs the Razorpay secrets from README.md).
