import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import {
  BUSINESS_ADDRESS,
  GRIEVANCE_OFFICER,
  GRIEVANCE_REPLY_BUSINESS_DAYS,
  OPERATOR_NAME,
  REFUND_CREDIT_BUSINESS_DAYS,
  REFUND_CUTOFF_HOURS,
  REFUND_START_BUSINESS_DAYS,
  SUPPORT_EMAIL,
  SUPPORT_PHONE,
} from '@/utils/constants'

const linkClass = 'font-semibold text-brand-600 hover:underline'

/** The support address as a mail link, or the in-app route when none is configured. */
function SupportContact() {
  return SUPPORT_EMAIL ? (
    <a className="font-semibold text-brand-600 hover:underline" href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  ) : (
    <span>
      <strong>Report a problem</strong> in Settings
    </span>
  )
}

function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink-100 bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft size={16} aria-hidden /> Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">{title}</h1>
        <p className="mt-1 text-sm text-ink-500">Last updated {updated}</p>
        <div className="mt-8 space-y-6 text-ink-700 [&_h2]:font-display [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc [&_p]:leading-relaxed [&_ul]:mt-2 [&_ul]:space-y-1.5">
          {children}
        </div>
      </main>
    </div>
  )
}

export function TermsPage() {
  return (
    <LegalShell title="Terms & Conditions" updated="20 November 2026">
      <section>
        <h2>1. About CrewDay</h2>
        <p>
          CrewDay is a platform for discovering and registering for social events, hobby meet-ups
          and activities, operated by {OPERATOR_NAME} ("we", "us"). By creating an account you agree
          to these terms.
        </p>
      </section>
      <section>
        <h2>2. Your account</h2>
        <p>
          You must be at least 18 years old to use CrewDay. You are responsible for the accuracy of
          the details on your profile and for keeping your sign-in credentials secure, and you may
          not impersonate another person. You can delete your account at any time from Settings
          or via the{' '}
          <Link to="/delete-account" className="font-semibold text-brand-600 hover:underline">
            delete account page
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>3. Registrations and tickets</h2>
        <ul>
          <li>A registration is personal to you and the QR code on it is single use.</li>
          <li>Seats are limited. Once an event reaches capacity, registration closes.</li>
          <li>
            You may cancel an upcoming registration from your ticket page; the seat is released to
            other members.
          </li>
          <li>
            Organisers may cancel or change an event. We will notify you in the app if that happens.
          </li>
        </ul>
      </section>
      <section>
        <h2>4. Paid events</h2>
        <p>
          Event prices are set by the organiser and shown before you register. Payments are
          processed by Razorpay; CrewDay never sees or stores your card, UPI or bank details. A
          registration for a paid event is only confirmed once Razorpay reports the payment as
          successful. Cancellations and refunds follow our{' '}
          <Link to="/refund-policy" className={linkClass}>
            Refund &amp; Cancellation Policy
          </Link>
          , and tickets are delivered as described in our{' '}
          <Link to="/shipping-policy" className={linkClass}>
            Delivery Policy
          </Link>
          .
        </p>
      </section>
      <section>
        <h2>5. Conduct at events</h2>
        <p>
          Treat other attendees and organisers with respect. We may suspend or remove accounts that
          harass others, misuse tickets, or repeatedly register and fail to attend.
        </p>
      </section>
      <section>
        <h2>6. Liability</h2>
        <p>
          CrewDay connects people with events; it does not run every event listed. Attending an
          activity is at your own risk, and you are responsible for your own safety and belongings.
        </p>
      </section>
      <section>
        <h2>7. Changes</h2>
        <p>
          We may update these terms as the product grows. Significant changes will be announced in
          the app. These terms are governed by the laws of India.
        </p>
      </section>
      <section>
        <h2>8. Contact</h2>
        <p>
          Questions or complaints about these terms: <SupportContact />. Our grievance officer and
          full contact details are on the{' '}
          <Link to="/contact" className={linkClass}>
            Contact &amp; Grievances
          </Link>{' '}
          page.
        </p>
      </section>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="20 November 2026">
      <section>
        <p>
          This policy explains what CrewDay collects, why, who can see it, and how you can have it
          deleted. It applies to the CrewDay website and the CrewDay Android app, which are the same
          product and share one account and one database.
        </p>
      </section>
      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> — your name and email address, and a profile photo if
            you add one or sign in with Google. Signing in with Google gives us your Google name,
            email and photo; we never see your Google password.
          </li>
          <li>
            <strong>Guest sessions</strong> — you can browse and book as a guest. A guest session
            creates an anonymous account with no name or email until you choose to save it.
          </li>
          <li>
            <strong>Profile details</strong> — phone number, city, area, interests and whether you
            join as participant or audience.
          </li>
          <li>
            <strong>Registrations</strong> — which events you register for, your ticket code and
            whether you were checked in. Your name, email and phone number are copied onto each
            registration so the organiser can run the event.
          </li>
          <li>
            <strong>Payments for paid events</strong> — you pay the organiser directly by UPI,
            using your own UPI app, or, where an event offers it, online through Razorpay. CrewDay
            stores only the payment status, the payment method and a payment reference; we never
            see or store your UPI PIN, bank account or card details.
          </li>
          <li>
            <strong>Things you write</strong> — event suggestions, problem reports and event
            feedback (a star rating and an optional comment), including the contact details you give
            on them.
          </li>
          <li>
            <strong>Device and usage data</strong> — if analytics is enabled, Google Analytics for
            Firebase records anonymous product events (for example sign-ups and registrations) and
            device identifiers. We do not send your name, email or phone number to analytics.
          </li>
          <li>
            <strong>Notification token</strong> — if you turn on push notifications in the browser,
            we store a device token so we can reach that browser. The Android app does not currently
            send push notifications.
          </li>
          <li>
            <strong>Camera</strong> — only organisers use it, to scan attendee QR tickets at the
            door. Images from the camera are read on your device and are not saved or uploaded.
          </li>
        </ul>
        <p>
          We do not collect your precise location. We never see or store your UPI PIN, bank account
          or card details; payments are handled by your UPI app or by Razorpay, and we keep only the
          payment status, method and reference.
        </p>
      </section>
      <section>
        <h2>2. How we use it</h2>
        <p>
          To create your profile, show you relevant events, issue and verify your tickets, tell you
          about events you registered for, let organisers run their events, handle problem reports,
          keep the service secure, and improve the product. We do not sell your data and we do not
          show ads.
        </p>
      </section>
      <section>
        <h2>3. Who can see it</h2>
        <ul>
          <li>Your email and phone number are never shown publicly.</li>
          <li>
            When you register for an event, the organiser of that event can see your name, email,
            phone number and check-in status — they need this to run the event.
          </li>
          <li>You control whether your name and interests appear to other attendees in Settings.</li>
          <li>
            CrewDay administrators can see profiles, registrations, suggestions and problem reports
            in order to run the service and respond to you.
          </li>
          <li>
            <strong>Legal reasons</strong> — we may disclose information if the law requires it.
          </li>
        </ul>
        <p>We do not share your personal data with advertisers or data brokers.</p>
      </section>
      <section>
        <h2>4. Service providers</h2>
        <p>We use these providers to run CrewDay. They process data on our behalf:</p>
        <ul>
          <li>
            <strong>Google Firebase</strong> — sign-in, the database (hosted in Mumbai, India),
            analytics and notifications.
          </li>
          <li>
            <strong>Google Sign-In</strong> — if you choose to sign in with Google.
          </li>
          <li>
            <strong>Google Fonts</strong> — the website loads its typeface from Google, so Google
            receives your IP address when a page loads.
          </li>
          <li>
            <strong>Vercel</strong> — hosts the website and may keep standard server logs.
          </li>
          <li>
            <strong>Razorpay</strong> — takes online payments (card, UPI, netbanking) for events that
            offer it. When you choose to pay online, your name, email and phone number are passed to
            Razorpay to complete the payment, and Razorpay's own privacy policy applies to the
            payment details you enter with them.
          </li>
        </ul>
      </section>
      <section>
        <h2>5. Your QR code</h2>
        <p>
          Your ticket QR contains only a random registration token. It carries no personal
          information, so a photo of your ticket does not expose your details.
        </p>
      </section>
      <section>
        <h2>6. Keeping and deleting your data</h2>
        <p>
          We keep your data while your account exists. You can delete your account at any time in
          the app or on the web under <strong>Settings → Delete account</strong>, or follow the steps
          on our <Link to="/delete-account" className="font-semibold text-brand-600 hover:underline">account deletion page</Link>,
          which you can open without signing in.
        </p>
        <p>When you delete your account we:</p>
        <ul>
          <li>cancel your upcoming registrations so the seats go back to other people;</li>
          <li>
            erase your name, email and phone number from your profile, tickets, waitlist entries,
            event suggestions and problem reports, and remove your feedback comments;
          </li>
          <li>delete your sign-in.</li>
        </ul>
        <p>
          What we keep: an anonymous attendance record (that a seat existed and whether it was used)
          and star ratings, so organisers keep accurate event records, and the subject and text of
          suggestions and reports you wrote. If you put personal details into free text, ask us to
          remove it. Records of payments (amount, date, payment method and the Razorpay order and
          payment references) are kept for as long as Indian tax and payment rules require, which
          can be up to 10 years, even after your account is deleted. Copies held in routine
          infrastructure logs or backups are removed as those age out.
        </p>
      </section>
      <section>
        <h2>7. Your choices</h2>
        <p>
          You can view and change your profile in Settings, switch notifications and visibility
          options off (in the app or in your phone's settings), and ask us for a copy of your data
          or its correction or deletion at any time. We will respond within 30 days.
        </p>
      </section>
      <section>
        <h2>8. Children</h2>
        <p>
          CrewDay is for people aged 18 and over. We do not knowingly collect data from anyone
          younger. If you believe a child has an account, contact us and we will delete it.
        </p>
      </section>
      <section>
        <h2>9. Security</h2>
        <p>
          Data is stored in Google Firebase and transmitted over HTTPS. Access is enforced by
          server-side security rules: a member can only read their own profile and registrations,
          and administrative data is restricted to authorised organiser accounts. No system is
          perfectly secure, so please use a strong, unique password.
        </p>
      </section>
      <section>
        <h2>10. International transfers</h2>
        <p>
          Our database is hosted in Mumbai, India. Our service providers (Google, Vercel and
          Razorpay) may process data in other countries and apply their own safeguards to those
          transfers under their privacy terms.
        </p>
      </section>
      <section>
        <h2>11. Changes and contact</h2>
        <p>
          We will announce significant changes to this policy in the app. Questions about your data,
          or requests to access, correct or delete it: <SupportContact />.
        </p>
      </section>
    </LegalShell>
  )
}

export function DeleteAccountPage() {
  return (
    <LegalShell title="Delete your CrewDay account" updated="24 October 2026">
      <section>
        <p>
          This page explains how to delete your CrewDay account and what happens to your data. It
          applies to both the CrewDay website and the CrewDay Android app.
        </p>
      </section>
      <section>
        <h2>Delete it yourself (fastest)</h2>
        <ul>
          <li>Open CrewDay (the app or the website) and sign in.</li>
          <li>
            Go to <strong>Settings</strong> and choose <strong>Delete account</strong>.
          </li>
          <li>
            Confirm with your password (or your Google account) and type <strong>DELETE</strong>.
          </li>
        </ul>
        <p>The deletion happens immediately and cannot be undone.</p>
      </section>
      <section>
        <h2>Can't sign in?</h2>
        <p>
          If you can no longer open the app, contact <SupportContact /> from the email address on
          the account and say you want it deleted. We will delete it within 30 days and confirm by
          email.
        </p>
      </section>
      <section>
        <h2>What is deleted</h2>
        <ul>
          <li>Your upcoming registrations are cancelled and the seats released.</li>
          <li>
            Your name, email address and phone number are erased from your profile, tickets,
            waitlist entries, event suggestions and problem reports.
          </li>
          <li>Your profile photo, city, area and interests are removed.</li>
          <li>Your feedback comments are removed.</li>
          <li>Your sign-in is deleted, so you can no longer log in with it.</li>
        </ul>
      </section>
      <section>
        <h2>What is kept</h2>
        <ul>
          <li>
            An anonymous record that a seat existed and whether it was used, and star ratings, so
            organisers keep accurate event history. These are no longer linked to your name or
            contact details.
          </li>
          <li>
            The subject and text of suggestions and reports you wrote. Ask us if you want any
            personal details in them removed.
          </li>
          <li>
            Payment records (amount, date, payment method and the Razorpay order and payment
            references), for as long as Indian tax and payment rules require, which can be up to
            10 years.
          </li>
          <li>Copies in routine infrastructure logs or backups, until they age out.</li>
        </ul>
      </section>
      <section>
        <p>
          Read the full <Link to="/privacy" className="font-semibold text-brand-600 hover:underline">Privacy Policy</Link>.
        </p>
      </section>
    </LegalShell>
  )
}

export function RefundPolicyPage() {
  return (
    <LegalShell title="Refund & Cancellation Policy" updated="20 November 2026">
      <section>
        <p>
          This policy covers tickets for paid events booked on CrewDay, operated by {OPERATOR_NAME}.
          Online payments are processed by Razorpay.
        </p>
      </section>
      <section>
        <h2>1. Cancelling your registration</h2>
        <ul>
          <li>
            You can cancel an upcoming registration from your ticket page in the app (My events, then
            open the ticket and choose Cancel). Your seat is released straight away.
          </li>
          <li>
            Cancel at least {REFUND_CUTOFF_HOURS} hours before the event starts and you get a{' '}
            <strong>full refund</strong> of the ticket price.
          </li>
          <li>
            Cancellations less than {REFUND_CUTOFF_HOURS} hours before the start, and no-shows, are{' '}
            <strong>not refunded</strong>, because the seat can rarely be filled at that point.
          </li>
          <li>Free events can be cancelled at any time; there is nothing to refund.</li>
        </ul>
      </section>
      <section>
        <h2>2. When the organiser cancels or changes an event</h2>
        <ul>
          <li>
            If an event is cancelled, you get a <strong>full refund</strong> automatically; you do
            not need to ask.
          </li>
          <li>
            If the date, time or venue changes significantly and you can no longer attend, cancel
            your ticket or contact us within 48 hours of the change being announced for a full
            refund.
          </li>
        </ul>
      </section>
      <section>
        <h2>3. Payment problems</h2>
        <ul>
          <li>
            If you were charged twice, or money left your account but your registration was not
            confirmed, the extra or failed amount is refunded in full. Write to <SupportContact />{' '}
            with your registration or Razorpay payment ID if you notice it before we do.
          </li>
        </ul>
      </section>
      <section>
        <h2>4. How and when refunds are paid</h2>
        <ul>
          <li>
            We start an approved refund within {REFUND_START_BUSINESS_DAYS} business days of the
            cancellation.
          </li>
          <li>
            Refunds go back to the original payment method (card, UPI, net banking or wallet)
            through Razorpay. Your bank usually credits it within {REFUND_CREDIT_BUSINESS_DAYS}{' '}
            business days after that.
          </li>
          <li>
            If you paid the organiser directly by UPI instead of online, the organiser returns the
            money to the same UPI account within the same timelines.
          </li>
          <li>Your ticket shows the refund once it has been processed.</li>
        </ul>
      </section>
      <section>
        <h2>5. Questions and complaints</h2>
        <p>
          Contact <SupportContact /> or see our{' '}
          <Link to="/contact" className={linkClass}>
            Contact &amp; Grievances
          </Link>{' '}
          page. We reply within {GRIEVANCE_REPLY_BUSINESS_DAYS} business days.
        </p>
      </section>
    </LegalShell>
  )
}

export function ShippingPolicyPage() {
  return (
    <LegalShell title="Delivery Policy" updated="20 November 2026">
      <section>
        <h2>Nothing is shipped</h2>
        <p>
          CrewDay sells registrations for events, not physical goods, so there is no shipping and
          no shipping charge.
        </p>
      </section>
      <section>
        <h2>How your ticket is delivered</h2>
        <ul>
          <li>
            Your ticket is delivered instantly in the app, under My events, as soon as your
            registration is confirmed. For paid events that is once Razorpay confirms the payment,
            usually within a few seconds.
          </li>
          <li>Show the QR code on your ticket at the venue to check in.</li>
        </ul>
      </section>
      <section>
        <h2>Ticket not showing?</h2>
        <p>
          If you paid but no ticket appears within 30 minutes, contact <SupportContact /> with your
          Razorpay payment ID. See also our{' '}
          <Link to="/refund-policy" className={linkClass}>
            Refund &amp; Cancellation Policy
          </Link>
          .
        </p>
      </section>
    </LegalShell>
  )
}

export function ContactPage() {
  return (
    <LegalShell title="Contact & Grievances" updated="20 November 2026">
      <section>
        <h2>Contact us</h2>
        <ul>
          <li>
            <strong>Operated by:</strong> {OPERATOR_NAME}
          </li>
          <li>
            <strong>Email:</strong> <SupportContact />
          </li>
          {SUPPORT_PHONE ? (
            <li>
              <strong>Phone:</strong>{' '}
              <a href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`} className={linkClass}>
                {SUPPORT_PHONE}
              </a>
            </li>
          ) : null}
          {BUSINESS_ADDRESS ? (
            <li>
              <strong>Address:</strong> {BUSINESS_ADDRESS}
            </li>
          ) : null}
        </ul>
      </section>
      <section>
        <h2>Grievance redressal</h2>
        <p>
          If you have a complaint about a booking, a payment, a refund or how your data is
          handled, contact our grievance officer by email{SUPPORT_PHONE ? ' or phone' : ''}. Please
          include your registration or Razorpay payment ID if it is about a payment.
        </p>
        <ul>
          <li>
            <strong>Grievance officer:</strong> {GRIEVANCE_OFFICER}
          </li>
          <li>
            <strong>Email:</strong> <SupportContact />
          </li>
          {SUPPORT_PHONE ? (
            <li>
              <strong>Phone:</strong> {SUPPORT_PHONE}
            </li>
          ) : null}
          <li>
            We acknowledge every complaint and respond within {GRIEVANCE_REPLY_BUSINESS_DAYS}{' '}
            business days.
          </li>
        </ul>
        <p>
          Payment disputes that we cannot resolve can also be raised with Razorpay at{' '}
          <a href="https://razorpay.com/grievances/" className={linkClass} rel="noreferrer" target="_blank">
            razorpay.com/grievances
          </a>
          .
        </p>
      </section>
      <section>
        <h2>Our policies</h2>
        <ul>
          <li>
            <Link to="/terms" className={linkClass}>Terms &amp; Conditions</Link>
          </li>
          <li>
            <Link to="/privacy" className={linkClass}>Privacy Policy</Link>
          </li>
          <li>
            <Link to="/refund-policy" className={linkClass}>Refund &amp; Cancellation Policy</Link>
          </li>
          <li>
            <Link to="/shipping-policy" className={linkClass}>Delivery Policy</Link>
          </li>
        </ul>
      </section>
    </LegalShell>
  )
}
