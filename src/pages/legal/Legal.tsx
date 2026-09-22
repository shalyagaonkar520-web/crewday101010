import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { SUPPORT_EMAIL } from '@/utils/constants'

function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-100 bg-white pt-safe">
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
    <LegalShell title="Terms & Conditions" updated="22 September 2026">
      <section>
        <h2>1. About CrewDay</h2>
        <p>
          CrewDay is a platform for discovering and registering for social events, hobby meet-ups
          and activities. By creating an account you agree to these terms.
        </p>
      </section>
      <section>
        <h2>2. Your account</h2>
        <p>
          You are responsible for the accuracy of the details on your profile and for keeping your
          sign-in credentials secure. You must be at least 18 years old, or have a parent or
          guardian's permission, and you may not impersonate another person. You can delete your
          account at any time from Settings or via the{' '}
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
          successful. If you cancel a paid registration, or the organiser cancels the event,
          refunds are handled by the organiser under the terms shown on the event and returned to
          the original payment method.
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
          Questions about these terms:{' '}
          <a href={'mailto:' + SUPPORT_EMAIL} className="font-semibold text-brand-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </section>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="22 September 2026">
      <section>
        <h2>1. What we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> — name, email address, and a profile photo if you add
            one.
          </li>
          <li>
            <strong>Profile details</strong> — phone number, city, area, interests and whether you
            join as participant or audience.
          </li>
          <li>
            <strong>Registrations</strong> — which events you register for, your ticket code and
            whether you were checked in.
          </li>
          <li>
            <strong>Payments</strong> — for paid events, the Razorpay order and payment ids and the
            amount. Card, UPI and bank details are entered on Razorpay's secure checkout and never
            reach CrewDay.
          </li>
          <li>
            <strong>Sign-in</strong> — if you use Google sign-in, Google shares your name, email
            and profile photo with us. We do not receive your Google password.
          </li>
          <li>
            <strong>Product analytics</strong> — anonymous counts of actions such as sign-ups and
            registrations. We do not send your name, email or phone number to analytics.
          </li>
        </ul>
        <p>
          The Android app asks for the <strong>camera</strong> only when an organiser scans ticket
          QR codes at check-in. Members are never asked for it, and no photos or video are stored.
          We do not collect your precise location; the city and area you choose are typed by you.
        </p>
      </section>
      <section>
        <h2>2. How we use it</h2>
        <p>
          To create your profile, show you relevant events, issue and verify your tickets, notify
          you about events you registered for, and improve the product.
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
        </ul>
      </section>
      <section>
        <h2>4. Your QR code</h2>
        <p>
          Your ticket QR contains only a random registration token. It carries no personal
          information, so a photo of your ticket does not expose your details.
        </p>
      </section>
      <section>
        <h2>5. Deleting your account</h2>
        <p>
          You can delete your account at any time from Settings, or from the{' '}
          <Link to="/delete-account" className="font-semibold text-brand-600 hover:underline">
            delete account page
          </Link>
          . Deletion is immediate: we cancel your upcoming registrations, remove your name, email,
          phone number, photo, location and interests from your profile and from every
          registration and waitlist entry, and delete your sign-in. Past attendance is retained
          only as an anonymous count so organisers keep accurate event records, and payment
          references are kept for as long as the law requires. If you cannot sign in, email us and
          we will delete the account within 7 days of confirming it is yours.
        </p>
      </section>
      <section>
        <h2>6. Storage and security</h2>
        <p>
          Data is stored in Google Firebase (Google Cloud, with data transmitted over encrypted
          connections). Access is enforced by server-side security rules: a member can only read
          their own profile and registrations, and administrative data is restricted to authorised
          organiser accounts. Our processors are Google Firebase (hosting, sign-in, database,
          notifications) and Razorpay (payments); we do not sell or share your data with anyone
          else.
        </p>
      </section>
      <section>
        <h2>7. Contact</h2>
        <p>
          Questions about your data, or a request to access or delete it? Email{' '}
          <a href={'mailto:' + SUPPORT_EMAIL} className="font-semibold text-brand-600 hover:underline">
            {SUPPORT_EMAIL}
          </a>{' '}
          or use <strong>Report a problem</strong> in Settings and we will get back to you.
        </p>
      </section>
    </LegalShell>
  )
}
