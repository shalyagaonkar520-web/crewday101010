Written for: the teammate who has the Google Play Console and Vercel logins.

# CrewDay: Play Store release

Status: the Android app is built and signed. The Play Console and the Vercel deploy are still to do. Nothing has been uploaded to Google Play yet.

## What's in this folder
| File | Use |
|---|---|
| `app-release-bundle.aab` (not in git) | Signed Android App Bundle (package `app.crewday`, version 1.0.0, code 1). Too large for the repo, so it is shared separately at `C:/Users/Ashritha S/crewday-release/app-release-bundle.aab`. Upload it to Play Console. |
| `play-store-listing.md` | Paste-ready store listing, data safety, content rating, target audience, app access. |
| `feature-graphic-1024x500.png` | Play feature graphic. |
| `screenshots/events-1080x1920.png` | Sample phone screenshot. Google asks for at least 2, so add real app screenshots from a logged-in device. |
| `android/twa-manifest.json` | Bubblewrap config used to build the app. Rebuilds need the keystore (not in git). |

The app icon (512×512) is `public/icons/icon-512.png` in the repo root.

## Step 0: Rebuild the bundle for Android 16 (API 36)  <- required

Google Play requires new apps and updates to target **Android 16 (API level 36)** (deadline 31 August 2026; the 1 November 2026 extension has also passed). The bundle first built for this folder targeted API 35, so Play Console would probably reject it. `android/twa-manifest.json` now says `targetSdkVersion: 36`; rebuild with the same upload keystore:

1. `bubblewrap update` (regenerates the Android project from the manifest), then `bubblewrap build`.
2. If your Bubblewrap version cannot target API 36, upgrade it (`npm i -g @bubblewrap/cli`) and retry. If it still cannot, ship the Capacitor build instead (see the Android section of the root README), which already targets API 36.
3. Check the result before uploading: open the `.aab` in Android Studio (Build > Analyze APK) or run `bundletool dump manifest` and confirm `targetSdkVersion` is 36.

Check Google's current requirement before you upload: <https://support.google.com/googleplay/android-developer/answer/11926878>.

## Step 1: Deploy the website (needed for full-screen Android mode)
The repo changes (`public/manifest.json`, `public/icons/`, `public/.well-known/assetlinks.json`, `vercel.json`) must go live on `https://crewday101010mm.vercel.app`. Until then the app still works but shows a browser address bar.

- Merge the PR into `main`, or deploy from the `play-store-setup` branch. Vercel should build it automatically if the project is connected to git.
- Or from a terminal: `npx vercel login` then `npx vercel --prod`.
- Check: `https://crewday101010mm.vercel.app/manifest.json` and `https://crewday101010mm.vercel.app/.well-known/assetlinks.json` should return JSON, not HTML.

## Step 2: Play Console
1. Create the release: Internal testing → Create new release → upload `app-release-bundle.aab`.
2. Store listing: paste from `play-store-listing.md`. Upload the 512 icon and the feature graphic. Add at least 2 real phone screenshots.
3. Complete Dashboard tasks: privacy policy (`https://crewday101010mm.vercel.app/privacy`), app access (test account), ads (No), content rating, target audience (18+), data safety, category (Events), contact email.
4. Roll out to Internal testing. The first upload goes through review.
5. Production needs a closed test with 12 opted-in testers running for 14 days. Only then does "Apply for production" unlock.

## Step 3: After Play App Signing is on
Play Console → Setup → App integrity → copy the **App signing key certificate SHA-256**. Add it to `public/.well-known/assetlinks.json` (next to the existing upload-key fingerprint) and redeploy. This removes the browser bar.

## Keys: keep these private
- Upload keystore: `C:\Users\Ashritha S\.crewday-keys\crewday-upload.jks`, password in `signing.properties` in the same folder. Not in git. It must be shared with the teammate through a secure channel (password manager, not chat or email). Losing it blocks future updates until Google resets the upload key.
- Upload key SHA-256: `FA:D8:6C:F9:8E:5B:A9:5B:20:E3:E6:80:E4:AC:01:82:D6:33:1C:E7:87:F6:1D:F4:0E:27:5D:45:1B:18:B3:39`

## Known gaps
- No real phone screenshots yet (only one sample).
- Firebase authorized domains: confirm `crewday101010mm.vercel.app` is listed under Authentication → Settings, or sign-in fails in the app.
- The privacy policy and data safety answers were written from the in-app policy. Check them against the actual data use before submitting.
