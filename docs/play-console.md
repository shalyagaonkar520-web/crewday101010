# Google Play Console — answer sheet for CrewDay

Answers for every task on the Play Console **Dashboard → Set up your app** list.
They describe what the code in this repo actually does, so they hold only while
the app behaves this way. If you add ads, payments, chat or location, revisit
the Ads, Data safety, Financial features and Content rating answers.

Items marked **YOU** need something only you can supply. Nothing here contains a
password; do not paste real credentials into this file.

## Before you start (YOU)

| Need | Why | Where it goes |
| --- | --- | --- |
| A support email address | Play requires a contact email, and the privacy policy and deletion page show one | Set `VITE_SUPPORT_EMAIL` in Vercel (Production + Preview), redeploy; use the same address on the store listing |
| Production domain | The live site is `https://crewday101010mm.vercel.app` unless you add a custom domain | Used in the two URLs below |
| A reviewer test account | Play reviewers must be able to open the app | See *Sign-in details* |

URLs for the forms (both are public and work signed out):

- Privacy policy: `https://crewday101010mm.vercel.app/privacy`
- Account deletion page: `https://crewday101010mm.vercel.app/delete-account`

Check both load in a private window before you submit.

---

## 1. Set privacy policy

Paste the privacy policy URL above. The policy is the in-app `/privacy` page
(`src/pages/legal/Legal.tsx`). It lists what is collected, the providers used,
retention and deletion, the 18+ rule and the contact address.

## 2. Sign-in details (app access)

Choose **All or some functionality in my app is restricted**, then add instructions.
Suggested text:

> CrewDay needs no account to browse: tap "Continue as guest" on the welcome
> screen to browse events and register for a free event.
> For a full member account use the login below. Organiser features (event
> creation, attendee list, QR check-in) are only available to organiser
> accounts; use the organiser login below.

**YOU:** create two throwaway accounts for the reviewer and put the details in
the console form (not in git):

- a normal member (sign up in the app with an email you control), and
- an organiser: sign up, then set `role` to `admin` on that user's document in
  Firestore → `users`. Make it a separate account, never your own owner account.

Use a password you can rotate after review.

## 3. Ads

**No, my app does not contain ads.** (The code includes no ad SDK.)

## 4. Content rating

Start the IARC questionnaire (category **Social / Events**, or the closest
"utility/reference" option if shown). Answer from the app's behaviour:

| Question | Answer |
| --- | --- |
| Violence, blood, gore, fear | No |
| Sexual content or nudity | No |
| Profanity or crude humour | No |
| Controlled substances (alcohol, drugs, tobacco) | No. Events are user-organised; the app does not promote or sell them |
| Gambling or simulated gambling | No |
| Users can interact or exchange content with each other | No chat, messaging or public posts. Members only see event details; their own suggestions, reports and feedback go to administrators |
| User-generated content shared with other users | No (event suggestions are reviewed by administrators; feedback is private to administrators) |
| Shares the user's precise location | No. The user types a city and area |
| Allows purchases | No. Prices are shown but payment is not processed in the app |

Google computes the final rating from your answers; expect a low age rating,
and note the audience below is 18+ regardless.

## 5. Target audience

- Target age group: **18 and over** only.
- Does the app appeal to children? **No.**
- This matches the Terms and Privacy Policy ("You must be at least 18").
  Choosing 18+ also keeps you out of the Families policy, which asks for far
  more.

## 6. Data safety

**Does your app collect or share any of the required user data types?** Yes.
**Is all of the user data collected by your app encrypted in transit?** Yes
(HTTPS to Firebase). **Do you provide a way for users to request that their data
be deleted?** Yes: in-app (Settings → Delete account) and the web URL above.

Per Google's definitions, data processed by Firebase/Google on your behalf is a
*service provider* and is **not** counted as "shared". Organisers are
administrators of the same app, not third parties. So **Data shared: none.**

Collected data (declare each as *collected*, not shared):

| Play data type | What it is in CrewDay | Required or optional | Purposes |
| --- | --- | --- | --- |
| Personal info → Name | Profile name | Required to create an account | App functionality, Account management |
| Personal info → Email address | Sign-in email | Required for email/Google accounts (not for guests) | App functionality, Account management, Communications |
| Personal info → Phone number | Phone on profile and tickets | Collected when registering for an event | App functionality |
| Personal info → User IDs | Firebase user id | Automatic | App functionality, Account management |
| Location → Approximate location | City and area the user types | Optional | App functionality, Personalisation |
| Photos and videos → Photos | Profile photo (also from Google sign-in); organiser event images | Optional | App functionality |
| App activity → App interactions | Analytics events such as sign-up, registration | Only if a measurement id is configured | Analytics |
| App info and performance | Not collected (no crash reporter is installed) | n/a | n/a |
| Device or other IDs | Analytics app-instance id; notification token (web only) | Only if analytics is on / the user turns push on | Analytics, App functionality |
| Other user-generated content | Event suggestions, problem reports, feedback comments | Optional | App functionality, Developer communications |
| Other info | Interests the user selects | Optional | Personalisation |

Not collected: financial info, health and fitness, messages, contacts,
calendar, web browsing, audio, files, precise location, installed apps.
The camera is used by organisers to scan QR tickets; images are processed on the
device and are not stored or sent, so camera data is **not** collected.

If you turn analytics off (leave `VITE_FIREBASE_MEASUREMENT_ID` empty) you may
remove the *App interactions* and *Device or other IDs* rows.

**Data deletion:** choose "Users can request deletion", link
`https://crewday101010mm.vercel.app/delete-account`. Say that deletion erases
name, email, phone and contact copies on tickets, waitlists, suggestions and
reports, removes feedback comments, and deletes the sign-in, and that anonymous
attendance and ratings are kept. Update this form if the behaviour changes.

## 7. Government apps

**No.** CrewDay is not made by or for a government.

## 8. Financial features

**My app doesn't provide any financial features.** Ticket prices are displayed
but no payment is taken in the app. Revisit this when payments are added.

## 9. Health

**No** health features.

## 10. App category and contact details

- App or game: **App**
- Category: **Events**
- Tags: Events, Social, Local, Hobbies (pick from Google's list)
- Email: **YOU** — your support address (shown on the listing)
- Website: `https://crewday101010mm.vercel.app`
- Phone: optional

## 11. Store listing text

Limits are Google's: title 30, short description 80, full description 4000.

**App name** (23 characters)

```
CrewDay: Find Your Crew
```

**Short description** (77 characters)

```
Find hobby meet-ups, jams and games near you. Book a seat, scan in with a QR.
```

**Full description**

```
CrewDay helps you find your crew. Browse local meet-ups, jams, pick-up games,
treks, photo walks, festivals and workshops, book a seat in a few taps, and
walk in with a QR ticket.

DISCOVER
• Browse events by category, date, price and location
• Pick your interests and see what is happening near you
• Join as a participant ("I want to take part") or as audience ("I want to
  watch and enjoy")
• Browse and book as a guest, then save your account when you are ready

BOOK
• Reserve a seat on free events instantly
• Join the waitlist when an event is full
• Cancel any time and the seat goes back to someone else

YOUR TICKET
• A private QR ticket for every booking, ready on your phone
• Add the event to your calendar
• The QR holds no personal details, so a photo of it reveals nothing about you

FOR ORGANISERS
• Create and publish events, set capacity and price
• See who is coming and export the attendee list
• Scan tickets at the door; each QR works once
• Handle no-shows and waitlists

YOUR DATA
• Delete your account any time from Settings. Your name, email and phone are
  erased from your profile and tickets.
• No ads. Your data is never sold.

CrewDay is for adults aged 18 and over.
```

**Graphics (YOU or ask me to prepare them)**

| Asset | Spec |
| --- | --- |
| App icon | 512 × 512 PNG, 32-bit, up to 1 MB. Exists: `public/icons/icon-512.png` (and a maskable variant) |
| Feature graphic | 1024 × 500 PNG or JPG. Exists: `playstore/feature-graphic-1024x500.png` |
| Phone screenshots | 2 to 8, 16:9 or 9:16, each side 320 to 3840 px. Suggested set: Explore, event detail, register, QR ticket, My events, organiser scanner |

Take screenshots from a real device or the emulator with real-looking data.
Do not show private emails or phone numbers.

## 12. Before you can release

- **Which build:** the Play listing uses the Trusted Web Activity in `playstore/` (see the Android section of the README). Upload the signed bundle described in `playstore/README.md`. The Capacitor `.aab` from `npm run android:bundle` is the dormant alternative; do not upload both.
- After the first upload, take the Play App Signing certificate SHA-256 from Play Console, add it to `public/.well-known/assetlinks.json` next to the upload-key fingerprint and redeploy, or Android shows a browser bar.
- The Capacitor-only steps (Firebase SHA registration, `google-services.json`) apply only if you choose that route.
- Register the release and Play App Signing SHA-1 and SHA-256 in Firebase, or
  Google sign-in fails on builds installed from Play.
- New personal developer accounts must run a **closed test with at least 12
  testers for 14 days** before production access; organisation accounts do not.
  Check the Console for the current rule.
- Upload to **Internal testing** first and test sign-in, booking, the QR ticket,
  the organiser scanner (camera permission) and account deletion on a real phone.

## Website checklist (same product)

- Set `VITE_SUPPORT_EMAIL` and redeploy.
- Test `/privacy` and `/delete-account` signed out.
- Confirm the production domain is in Firebase → Authentication → Authorized domains.
- Check a Vercel preview for Content-Security-Policy console warnings before
  switching the header from Report-Only to enforcing.
