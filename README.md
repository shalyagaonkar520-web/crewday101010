# CrewDay

**Find your crew. Make your day.**

A social event platform for people who want to meet others through shared
interests — jams, pick-up games, treks, photo walks, festivals and workshops.
Members join an event as a **participant** ("I want to participate") or as
**audience** ("I want to watch and enjoy"), get a QR ticket, and get scanned in
at the door.

Built with React + TypeScript + Vite + Tailwind CSS on a real Firebase backend
(Auth, Firestore, Storage, Cloud Messaging). Mobile-first, deployable to Vercel
or Firebase Hosting.

---

## Contents

1. [What works end to end](#what-works-end-to-end)
2. [Quick start](#quick-start)
3. [Firebase setup](#firebase-setup)
4. [Creating your first organiser](#creating-your-first-organiser)
5. [Deployment](#deployment)
6. [Architecture](#architecture)
7. [Data model](#data-model)
8. [Security model](#security-model)
9. [Cloud Functions (optional)](#cloud-functions-optional)
10. [Paid events](#paid-events)
11. [Known limits and next steps](#known-limits-and-next-steps)

---

## What works end to end

| Flow | Status |
| --- | --- |
| Google sign-in, email/password sign-up, email verification, password reset | ✅ |
| Three-step onboarding: interests (with "add your own") → participant/audience → city | ✅ |
| Profile creation, editing, photo upload, interest changes | ✅ |
| Home with "What are you doing this Sunday?", featured and interest rails | ✅ |
| Explore with search + date/category/price/role/location filters, URL-shareable | ✅ |
| Admin event creation, image upload, edit, duplicate, publish/unpublish, cancel, delete | ✅ |
| Free registration with atomic capacity enforcement and one-seat-per-person | ✅ |
| Unique registration code + high-entropy QR token per registration | ✅ |
| My Events (Upcoming / Past / Attended / Cancelled) with live ticket updates | ✅ |
| QR ticket page, add-to-calendar, self-cancellation | ✅ |
| Admin camera QR scanner with valid / invalid / duplicate-scan handling | ✅ |
| Attendance recording, manual check-in, undo check-in | ✅ |
| Admin attendee list with statistics and CSV export | ✅ |
| Waitlist join/leave and admin promotion | ✅ |
| In-app notifications; FCM push via Cloud Functions | ✅ |
| Event cancellation notifies every registered attendee | ✅ |
| Admin dashboard: users, events, registrations, attendance, funnel, interests, revenue | ✅ |
| Admin user management: search, suspend, restore, grant/revoke organiser, anonymise | ✅ |
| Admin interest management: add, rename, disable, delete unused | ✅ |
| Account deletion (releases seats, anonymises profile, deletes the sign-in) | ✅ |
| Firestore + Storage security rules enforcing every rule above | ✅ |
| Production build, code splitting, responsive mobile → desktop | ✅ |

Nothing is faked: every button writes to or reads from Firebase. There is no
mock data, no `localStorage` database and no simulated scanner.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in your Firebase web config
npm run dev
```

The app runs at <http://localhost:5173>. Until `.env.local` has real keys, the
login screen tells you exactly which values are missing.

Other scripts:

```bash
npm run build        # typecheck + production build into dist/
npm run typecheck    # TypeScript only
npm run preview      # serve the production build locally
npm run emulators    # Firebase emulator suite (see below)
npm test             # render smoke tests + security rules tests
```

### Tests

Two suites, both runnable with no Firebase project of your own:

```bash
npm run test:dom     # renders the real app in jsdom
npm run test:rules   # runs firestore.rules against the emulator (needs Java)
```

- **`tests/app.dom.test.tsx`** mounts the actual app — providers, router and
  lazy route chunks — and asserts the landing page, both auth screens, guest
  browsing, the sign-in redirect for member routes, the `/admin` redirect and
  the 404 all render.
- **`tests/firestore.rules.test.ts`** runs 64 assertions against the real rules
  engine in the Firestore emulator. It is the proof behind every claim in
  [Security model](#security-model): self-promotion to admin is rejected, a
  mismatched price is rejected, a client-set `checked_in` is rejected, a paid
  registration cannot be self-confirmed, capacity cannot be exceeded, drafts
  are invisible, and one member cannot read or tamper with another's data.

If port 8080 is already in use, stop the stale emulator before re-running.

---

## Firebase setup

### 1. Create the project

1. <https://console.firebase.google.com> → **Add project**.
2. **Build → Authentication → Get started**, then enable:
   - **Email/Password** (leave "Email link" off)
   - **Google**
3. **Build → Firestore Database → Create database** (production mode, pick a
   region close to your users, e.g. `asia-south1`).
4. **Build → Storage → Get started**.

### 2. Register the web app

**Project settings → General → Your apps → Web (`</>`)**. Copy the config
values into `.env.local`:

```ini
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_FIREBASE_MEASUREMENT_ID=...     # optional, enables analytics
VITE_FIREBASE_VAPID_KEY=...          # optional, enables web push
```

These values are public by design — they identify the project, they do not
grant access. All authorisation is enforced by the security rules. **Never put
a service-account key in this file.**

For push notifications, generate a key pair under **Project settings → Cloud
Messaging → Web Push certificates** and paste it into `VITE_FIREBASE_VAPID_KEY`.

### 3. Deploy the rules and indexes

```bash
npm install -g firebase-tools
firebase login
cp .firebaserc.example .firebaserc     # then set your project id
npm run deploy:rules
```

This publishes `firestore.rules`, `firestore.indexes.json` and `storage.rules`.
**Do this before using the app** — the default "production mode" rules deny
everything.

> If you later add an unusual filter combination in Explore, Firestore will
> return an error containing a one-click link to create the missing composite
> index. That is normal; add the generated index to `firestore.indexes.json` so
> it is version controlled.

### 3a. Open rules for local development (optional, temporary)

If you want to click through the app before the real rules are in place, there
is a wide-open set checked in as `firestore.rules.dev` / `storage.rules.dev`:

```bash
npm run rules:dev     # points firebase.json at the open rules and deploys them
npm run rules:prod    # switches back to the locked-down rules and deploys
```

While the open rules are live, **anyone who has the Firebase web API key can
read and write the entire database** — and that key ships inside the
JavaScript bundle, so it is public the moment the site is. That means every
member's email address and phone number, every ticket, and the `role` field
that grants organiser access. Use them on localhost only, and run
`npm run rules:prod` before the app is reachable at a public URL.

They carry an expiry date (18 October 2026) so that forgetting is survivable
rather than permanent. `firebase.json` always shows which set is currently
selected.

### 4. Authorise your domains

**Authentication → Settings → Authorized domains** — add your Vercel and/or
Firebase Hosting domains, otherwise Google sign-in fails in production.

### 5. Run against the emulator (optional)

```bash
firebase emulators:start
# then set VITE_USE_FIREBASE_EMULATORS=true in .env.local and restart `npm run dev`
```

---

## Creating your first organiser

There is deliberately **no hardcoded admin password and no secret admin URL**.
`/admin` is an ordinary Firebase sign-in; authorisation comes from the `role`
field on the user document, which the security rules check on every privileged
operation and which no client is allowed to write.

To create the first organiser:

1. Sign up through the normal app (`/signup`) with the email you want to use.
2. Open **Firebase console → Firestore → `users` → your document**.
3. Change `role` from `user` to `admin`. Save.
4. Go to `/admin/login` and sign in.

From then on, promote and demote organisers from **Admin → Users → Manage**.

If you deploy the Cloud Functions, you can instead set a
`BOOTSTRAP_ADMIN_EMAIL` environment variable and call the `setOrganiserRole`
callable once from that account.

### First run checklist

After signing in as an organiser:

1. **Admin → Interests → Seed starter interests** — so the first member does
   not see an empty onboarding screen. (Interests are fully database-driven;
   the seed list is only a convenience.)
2. **Admin → Create event** — fill it in and hit **Publish event**. It appears
   in the member app immediately.

---

## Deployment

### Vercel

1. Import the repository.
2. Framework preset: **Vite**. Build: `npm run build`. Output: `dist`.
3. Add every `VITE_*` variable from `.env.local` under
   **Settings → Environment Variables**.
4. Deploy, then add the resulting domain to Firebase **Authorized domains**.

`vercel.json` already handles SPA rewrites, immutable asset caching, the
service worker headers and basic security headers.

### Firebase Hosting

```bash
npm run deploy:hosting     # build + deploy
npm run deploy             # build + deploy hosting, rules, indexes and functions
```

---

## Android app

The same codebase ships as an Android app. [Capacitor](https://capacitorjs.com)
loads the production web build (`dist/`) into a WebView inside a native shell;
the native project lives in [`android/`](android/) and opens directly in
Android Studio. There is one codebase, one Firebase project and one set of
security rules -- the app is the website in a different wrapper.

### Build and run

```bash
npm run android:sync   # builds the web app and copies it into android/
npm run android:open   # opens android/ in Android Studio
```

Then press **Run** in Android Studio with a device or emulator selected. Re-run
`npm run android:sync` after every change to the web code -- Android Studio
does not rebuild the web app for you. `npm run android:apk` produces
`android/app/build/outputs/apk/debug/app-debug.apk` from the command line.

### Google sign-in on Android (one-time setup)

Everything except Google sign-in works out of the box. A WebView cannot open
the OAuth popup the website uses, so on Android the native Google Sign-In
sheet runs instead and hands its token to the Firebase JS SDK
(`src/services/authService.ts`). That native path needs the app registered
with Firebase:

1. **Firebase console -> Project settings -> Your apps -> Add app -> Android.**
   Package name `app.crewday`.
2. **Add the debug signing SHA-1.** Get it with
   `cd android && gradlew signingReport` (look for `Variant: debug`), or from
   Android Studio: Gradle panel -> app -> Tasks -> android -> signingReport.
   Without it Google sign-in fails with `DEVELOPER_ERROR` / error code 10.
3. **Download `google-services.json`** and put it at
   `android/app/google-services.json`. The Gradle build applies the Google
   Services plugin only when this file exists, so the app builds either way.
4. `npm run android:sync` and run again.

Before publishing, add the release keystore's SHA-1 too, and the Play
App Signing certificate's SHA-1 once Play generates it.

### What differs from the website

| Area | Website | Android app |
| --- | --- | --- |
| Google sign-in | Firebase popup | Native Google sheet (needs setup above) |
| Push notifications | Web push via service worker | Off (`isPushSupported()` returns false in the shell). Native FCM is a follow-up. |
| Share button | Web Share API | Falls back to copying the link |
| QR scanning | Camera via `getUserMedia` | Same; the manifest declares `CAMERA` and Android prompts on first use |
| Back button | Browser | Hardware back walks the router history, then backgrounds the app |
| Origin | Your domain | `https://localhost` -- already an authorised Firebase Auth domain |

Email links (verification, password reset) still open in the phone's browser,
not the app; wiring Android App Links for them is on the list in
[Known limits and next steps](#known-limits-and-next-steps).

---

## Architecture

```text
src/
  components/
    ui/          Button, Field, Card, Modal, Tabs, Avatar, Feedback (loading/empty/error)
    events/      EventCard, EventGrid, EventFilterBar
    layout/      AppHeader, BottomNav, Logo
    qr/          QRTicket (generation), QRScanner (camera decoding)
  firebase/      SDK initialisation, collection names, emulator wiring
  services/      Every Firebase read and write lives here — no component
                 touches Firestore directly
  store/         AuthContext (live user + profile), ToastContext
  hooks/         useAuth, useToast, useEvents, useMyRegistrations, useDebounce
  layouts/       UserLayout, AdminLayout, AuthLayout
  pages/
    auth/        Login, Signup, ForgotPassword, VerifyEmailBanner
    user/        Onboarding, Home, Explore, EventDetail, RegisterForEvent,
                 RegistrationSuccess, MyEvents, TicketPage, Profile,
                 EditProfile, Settings, Notifications
    admin/       AdminLogin, Dashboard, AdminEvents, EventForm,
                 EventAttendees, CheckIn, AdminUsers, AdminInterests,
                 AdminReports
    legal/       Terms, Privacy
  routes/        Route table and guards
  types/         Domain model
  utils/         format, validation, ids (QR tokens), csv, constants
functions/       Optional Cloud Functions (push, reminders, scheduled jobs)
```

The rule that keeps this maintainable: **UI never calls Firestore**. Pages call
services; services own queries, transactions and validation.

### Performance

- Every route is lazily loaded; the admin bundle and the ~370 KB QR decoder
  never reach a member who is just browsing.
- Event lists are cursor-paginated (`limit(n + 1)` to detect a next page).
- Dashboard headline numbers use Firestore `count()` aggregations, not
  document reads.
- Event images are downscaled to WebP in the browser before upload.
- Search is served by a `searchTokens` array on each event (word + prefix
  tokens), so it runs as an indexed `array-contains` rather than a client scan.

---

## Data model

```text
users/{uid}
  uid, name, email, phone, photoURL, city, area,
  interests[], participationType, role, status, onboardingCompleted,
  notificationPrefs{}, privacyPrefs{}, fcmTokens[],
  eventsRegistered, eventsAttended,
  createdAt, updatedAt, lastActiveAt

events/{eventId}
  title, description, imageURL, imagePath, category,
  date (YYYY-MM-DD), startTime, endTime, startsAt (Timestamp),
  weekday (0–6), isFree, searchTokens[],
  venue, address, city, area, mapsURL,
  capacity, price, currency, eventTypes[], status, featured,
  waitlistEnabled, tags[],
  registeredCount, participantCount, audienceCount, checkedInCount, waitlistCount,
  createdBy, createdAt, updatedAt

registrations/{eventId}__{uid}        ← deterministic id = one seat per person
  registrationCode, eventId, eventTitle, eventDate, eventStartTime,
  eventVenue, eventImageURL, userId, name, email, phone,
  participationType, price, currency, paymentStatus, registrationStatus,
  qrToken, attendanceStatus, registeredAt, checkInTime, checkedInBy,
  cancelledAt, cancelledReason, updatedAt

interests/{slug}       name, emoji, category, enabled, custom, usageCount
waitlists/{eventId}__{uid}
notifications/{id}     userId, type, title, body, eventId, read, createdAt
feedback/{eventId}__{uid}
reports/{id}
```

`weekday`, `isFree` and `searchTokens` are derived on every write so Firestore
can answer "Sundays only", "free only" and text search server-side. Counters on
the event document are maintained by transactions, not recomputed.

### Why the registration id is deterministic

`registrations/{eventId}__{uid}` makes "one person, one seat" an invariant of
the data model rather than something a race can break — a second attempt lands
on the same document inside the same transaction. The id is not a secret; the
QR is validated against the separate `qrToken`, which is.

---

## Security model

Route guards decide which screen you see. **Security rules decide what you can
actually read and write.** Typing `/admin` into the address bar without the
`admin` role produces an empty, permission-denied screen.

What the rules enforce (`firestore.rules`):

- **No self-promotion.** A member updating their own profile must leave `role`,
  `status` and `uid` byte-identical. Only an existing admin can grant the admin
  role.
- **Price is never trusted from the client.** Creating a registration is only
  allowed if `price` and `currency` match the event document, read server-side
  with `get()`.
- **Free vs paid is not negotiable.** `registrationStatus` must be `confirmed`
  for a ₹0 event and `pending_payment` for a paid one. A client cannot mark a
  paid registration as confirmed.
- **Attendance is organiser-only.** `attendanceStatus`, `checkInTime` and
  `checkedInBy` are rejected on any member write.
- **Capacity cannot be exceeded**, even by a crafted API call: the event's
  counter update is bounded by `registeredCount <= capacity` and by ±1 per
  write, and members may only touch those counter fields.
- **Members read only their own data** — profile, registrations, notifications.
- **Drafts are invisible** to anyone but an organiser.
- **Everything unmatched is denied** by a final catch-all rule.

`storage.rules` restricts event images to organisers and scopes avatar uploads
to `avatars/{uid}/`, both capped at 5 MB and image content types.

### QR security

Each registration carries two separate values:

| Value | Example | Visibility | Purpose |
| --- | --- | --- | --- |
| `registrationCode` | `CD-2026-8F4A92` | printed on the ticket | human reference |
| `qrToken` | 160 bits of CSPRNG | inside the QR only | proves the ticket |

The QR encodes `CDQR1|<registrationId>|<qrToken>` — **no name, email or phone**,
so a photo of someone's ticket leaks nothing. Check-in requires a token match,
so a copied registration code cannot be turned into a scan. Cancelling a
registration rotates the token to `revoked-…`, immediately killing any
screenshot of the old ticket.

Check-in runs in a transaction that verifies, in order: the registration
exists, the token matches, it belongs to *this* event, it is not cancelled, it
is confirmed, and it has not already been scanned. A second scan reports
**ALREADY CHECKED IN** with the original check-in time and writes nothing.

---

## Cloud Functions (optional)

The app is fully functional without them — registration, check-in and in-app
notifications all work on the **free Spark plan**. Deploying `functions/`
(requires the **Blaze** plan) adds what a browser cannot do:

| Function | Trigger | What it does |
| --- | --- | --- |
| `pushOnNotificationCreated` | Firestore | Mirrors in-app notifications to FCM, prunes dead tokens |
| `sendEventReminders` | hourly | 24-hour and 2-hour reminders, stamped so they never double-send |
| `completePastEvents` | daily 03:00 | Rolls past events to `completed`, marks unscanned tickets `no_show` |
| `announceNewEvent` | Firestore | Tells members in the same city about a newly published event |
| `setOrganiserRole` | callable | Grants/revokes organiser access (admin only, plus one-time bootstrap) |
| `anonymiseDeletedUser` | Auth | Scrubs personal data if an auth account is deleted from the console |

```bash
cd functions && npm install
cd .. && npm run deploy:functions
```

Set the region in `functions/src/index.ts` (`setGlobalOptions`) to match your
Firestore region.

---

## Paid events

Phase 1 is deliberately free-first, but the architecture is already in place:

- Admins set any price. `₹0` renders as **FREE** everywhere.
- A registration for a paid event is created as `pending_payment` /
  `paymentStatus: 'pending'` and **its QR does not activate**. The security
  rules make it impossible for a client to write `paid` or `confirmed`.
- The seat is held while payment is pending, so a paid event cannot oversell
  during checkout.
- To add Razorpay (or any provider): call `confirmPaidRegistration()` from a
  **verified server-side webhook** (a Cloud Function), never from the browser,
  and tighten the registration update rule to admin-only for `paymentStatus`.

Revenue reporting on the dashboard stays hidden until at least one paid event
exists.

---

## Known limits and next steps

- **Waitlist promotion is a one-tap admin action**, not automatic. Promoting
  someone means writing another person's registration, which members are
  (correctly) not allowed to do. Automating it belongs in a Cloud Function
  triggered on cancellation.
- **Search is prefix + word based**, served by `searchTokens`. Good to roughly
  a few thousand events; beyond that, move to Algolia or Typesense.
- **Deleting a member from the admin panel anonymises the profile** but cannot
  delete their Firebase Auth account — that needs the Admin SDK. Deploy
  `functions/` or remove the sign-in from the console. Self-service deletion
  from Settings *does* delete the auth account.
- **Analytics** logs the product funnel events listed in the brief and
  deliberately sends no names, emails or phone numbers.
- **Push on iOS** requires the site to be installed to the home screen; the
  Settings toggle reports this honestly instead of silently failing.
