# Razorpay online payments — owner checklist

> **Status: written and tested, but never run against real Razorpay.**
> The pure helpers in `functions/src/razorpay.ts` (signatures, amounts, payload
> parsing) are covered by `npm run test:unit`. The two Vercel API routes
> (`api/razorpay-order.ts`, `api/razorpay-webhook.ts`) are covered by unit tests
> and by emulator tests of the Firestore logic with a faked Razorpay reply
> (`tests/paymentsApi.*.test.ts`). None of it has talked to Razorpay's real API
> or been deployed. Treat the whole flow as **unverified until test-mode
> payments succeed end to end** (step 7).

The server side runs as **Vercel API routes** on the same domain as the app. No
Firebase Blaze plan is needed: the project stays on the free Spark plan. Until
the steps below are done, online payment is off and paid events are settled
offline: the registration stays `pending_payment` and an organiser records the
UPI payment by hand.

> **Vercel plan caveat.** Vercel's free **Hobby** plan is for personal,
> non-commercial use. Charging for tickets is commercial use, so you may need a
> paid Vercel plan (Pro). Read Vercel's current terms and Fair Use policy before
> going live; this document cannot tell you which plan you need.

## How it works

1. A member registers for a paid event. The registration is saved as
   `pending_payment` / `pending`.
2. The app calls `POST /api/razorpay-order` with the member's Firebase ID token
   (`Authorization: Bearer ...`) and only the registration id. The route
   verifies the token, checks the member owns a pending registration, reads the
   **event's** price on the server (rupees, converted to paise), creates a
   Razorpay order and stores `razorpayOrderId` on the registration. It returns
   `{ orderId, amount, currency, keyId }`; the key id is public and comes from
   the route, not from a `VITE_` variable.
3. The member pays in Razorpay Checkout.
4. Razorpay calls `POST /api/razorpay-webhook`. The route reads the raw body,
   verifies the `X-Razorpay-Signature` HMAC before parsing anything, then inside
   a Firestore transaction re-checks amount, currency, order id and status before
   marking the registration `paid` / `confirmed`. The browser can never confirm a
   payment itself, and members cannot write payment fields (see
   `firestore.rules`).
5. Anything that cannot be confirmed is written to the `paymentIssues`
   collection for a manual refund (see *Refunds*).

The routes use the Firebase **Admin SDK** with a service account, which bypasses
security rules. That is why the account must be least-privilege (step 2).

The Cloud Functions version in `functions/src/payments.ts` is a **dormant
alternative**: it implements the same logic but needs the Blaze plan and is not
used by the app. Leave it undeployed unless you deliberately move back to
Functions.

## 1. Create the Razorpay account (test mode first)

Sign up at razorpay.com and stay in **Test Mode** (toggle in the dashboard).
Generate test API keys under Account & Settings → API Keys. The key secret is
shown once; store it somewhere safe. Live mode needs completed KYC and is only
used at go-live (step 8).

## 2. Create a least-privilege Google Cloud service account

The routes need to read and write Firestore and nothing else.

1. Google Cloud console → project `crewday-2657d` → IAM & Admin → Service
   Accounts → **Create service account**. Name it for example `payments-api`.
2. Grant it **only** the role **Cloud Datastore User** (`roles/datastore.user`).
   Do not grant Owner, Editor, Firebase Admin or any other role.
3. Open the account → Keys → **Add key → Create new key → JSON**. A file
   downloads. This is a secret.
4. Paste the file's whole contents into Vercel in step 3, then **delete the
   downloaded file**. Never commit it, paste it into chat, an issue or a file in
   the repo.
5. Rotate it periodically (create a new key, update Vercel, redeploy, delete the
   old key in the console) and immediately if it may have leaked.

Verifying the member's Firebase ID token needs no extra role: it uses Google's
public signing keys.

## 3. Set the Vercel environment variables

Vercel → Project → Settings → Environment Variables. Add each of these for the
**Production** environment (and Preview only if you want to test there with test
keys), and mark every one **Sensitive**. None of them may start with `VITE_`;
that prefix would publish the value in the browser bundle.

| Name | Value |
| --- | --- |
| `RAZORPAY_KEY_ID` | Razorpay API key id (`rzp_test_...` in test mode) |
| `RAZORPAY_KEY_SECRET` | Razorpay API key secret |
| `RAZORPAY_WEBHOOK_SECRET` | A long random string you choose now; you enter the same value in the Razorpay dashboard in step 5 |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | The whole service-account JSON file from step 2 (or that JSON base64-encoded; both work) |

Optional: `FIREBASE_PROJECT_ID` (defaults to `crewday-2657d`).

If any of these is missing the routes answer `503 Online payments are not set up
yet` and the app tells the member to pay by UPI instead; nothing crashes.

## 4. Switch the button on in the app

The app only shows the pay button when the public build flag is set. Add
`VITE_ONLINE_PAYMENTS=true` (Production, and Preview if wanted) in the same
Vercel settings page. This is a public flag, not a secret. Leave it unset (or
`false`) while the variables above are not in place.

Then **redeploy** (Deployments → Redeploy). Variables only take effect on a new
deployment, and `VITE_` values are baked in at build time.

## 5. Register the webhook in Razorpay

Dashboard → Account & Settings → Webhooks → Add new webhook:

- **URL:** `https://crewday.nirmaansolutions.in/api/razorpay-webhook`
- **Secret:** the same value you set as `RAZORPAY_WEBHOOK_SECRET`
- **Events:** `payment.captured` and `order.paid`

Test and live mode have separate webhooks; create one in each when you get there.

Check in the Razorpay Payments settings that payments are **captured
automatically** (the default). If authorised payments are left for manual
capture, `payment.captured` never fires and nobody is confirmed.

## 6. Check the wiring

Before taking a payment, open `https://crewday.nirmaansolutions.in/api/razorpay-webhook`
in a browser. A `405 Method not allowed` JSON reply means the route is deployed
(it only accepts POST). A `404` means the routes did not deploy; check the
Vercel build log. A `503` on a signed POST means a variable from step 3 is
missing or the deployment predates it.

## 7. Test end to end in test mode

Do not skip this; nothing here has been exercised against Razorpay yet.

1. Create a paid test event (for example ₹10) and register with a test account.
2. Pay with a Razorpay test card or UPI test ID from the Razorpay docs
   (Test Mode → Payments → test cards). Try a success and a failure.
3. Confirm the registration becomes `confirmed` / `paid` with `razorpayPaymentId`
   and `paidAt`, and the ticket appears.
4. In the Razorpay dashboard open the webhook's delivery log and replay the same
   delivery. The registration must not change (the replay is a no-op).
5. Cancel a pending registration, then complete a payment against its old order if
   you can: nothing should confirm, and a `paymentIssues` document should appear.
6. Check Vercel → Project → Logs (filter on `/api/razorpay-order` and
   `/api/razorpay-webhook`) for errors after each step. Logs contain ids and
   reasons, never secrets or full payloads.

## 8. Go-live checklist

- [ ] Steps 1 to 7 pass in test mode
- [ ] Razorpay KYC and settlement bank account approved
- [ ] Vercel plan checked against Vercel's terms for commercial use (see the caveat
      at the top)
- [ ] Live key id and key secret set in Vercel (sensitive), then redeploy
- [ ] A live-mode webhook created with its own secret (update
      `RAZORPAY_WEBHOOK_SECRET` to match, then redeploy)
- [ ] One real low-value payment made and then refunded from the dashboard
- [ ] Service-account key rotation reminder set
- [ ] Privacy policy and Play Console answers updated (see below)
- [ ] Refund and cancellation wording agreed for paid events

## Refunds and `paymentIssues`

Refunds are **manual**: issue them from the Razorpay dashboard (Transactions →
Payments → Refund). The app does not issue refunds and does not yet mark a
registration `refunded` automatically.

If a payment arrives that must not confirm a seat, the webhook leaves the
registration untouched, logs an error, replies 200 so Razorpay stops retrying,
and writes a document to the `paymentIssues` collection, keyed by the Razorpay
payment id so replays do not duplicate it. **No client can read `paymentIssues`**
(`firestore.rules` grants it to nobody, admins included); only the Admin SDK and
the Firebase console can. Review it in the Firebase console (Firestore Database →
`paymentIssues`) regularly. Fields: `registrationId`, `razorpayPaymentId`,
`razorpayOrderId`, `reason`, `amount` (paise), `currency`, `userId`, `eventId`,
`resolved` (always `false` when written; set it by hand after refunding),
`createdAt`.

| `reason` | Meaning | Usual action |
| --- | --- | --- |
| `registration_cancelled` | Member cancelled before the payment arrived | Refund |
| `amount_mismatch` | Paid amount differs from the event's current price (for example the price was edited after the order was created) | Refund, or contact the member |
| `order_mismatch` | Paid against an order other than the latest one stored on the registration (for example Checkout opened twice and the older order was paid) | Check the payment; refund, or confirm by hand if it is genuine |
| `duplicate_payment` | The registration was already paid by a different payment | Refund the duplicate |
| `currency_mismatch`, `invalid_event_price`, `registration_not_pending`, `already_paid`, `event_missing`, `unknown_registration` | Unexpected state | Investigate in the logs, then refund |

## Play Console and privacy updates when payments go live

`docs/play-console.md` currently states the app has no payments. Revisit these
before enabling online payment in the Play build:

- **Data safety:** declare *Financial info → Purchase history* as collected
  (payment status and Razorpay payment/order reference, linked to the account,
  used for app functionality, not shared for advertising). Card, UPI and bank
  details are entered on Razorpay's Checkout and are processed by Razorpay; the
  app and our servers never see or store them. Razorpay is a third-party service
  that receives the payer's contact details and payment details, so list that
  sharing for payment processing. Keep "data encrypted in transit" as Yes.
- **Financial features:** the app now takes payments for event tickets. Re-answer
  the Financial features declaration accordingly (it is not a banking, loan or
  crypto app).
- **Payments policy:** tickets for in-person events are physical-world goods and
  services, so Google Play Billing is not required, but state this in the review
  notes and give reviewers a way to see the flow (test mode, or a free event).
- **Privacy policy** (`src/pages/legal`): already names Razorpay as a payment
  processor; confirm it also covers what is stored (payment status, amount,
  Razorpay payment and order ids), that card/UPI details are never stored by
  CrewDay, and refunds and how long payment records are kept.
- **Content Security Policy:** `vercel.json` already allows Razorpay Checkout in
  the Report-Only policy, and `connect-src 'self'` covers the `/api` calls. Watch
  the browser console for violation reports during testing before turning the
  policy into an enforcing one.
- **Android app (TWA):** Checkout opens inside the Trusted Web Activity. Confirm in
  test mode on a real device that UPI app hand-off and the return to the app work.

## Known limits

- Only the latest Razorpay order id on a registration is accepted. If a member
  opens Checkout twice and pays the older order, the payment lands in
  `paymentIssues` instead of confirming automatically.
- The webhook does not send the member a notification or email when a payment
  confirms; they see the change in the app.
- Vercel's handling of the routes (the TypeScript build of `api/`, importing
  `functions/src/razorpay.ts`, the 15 second `maxDuration`) has not been
  exercised on a real deployment. Check the first preview deployment's build log.
- Everything above is unverified against real Razorpay until step 7 is done.
