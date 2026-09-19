import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'

function LegalShell({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-ink-50">
      <header className="border-b border-ink-100 bg-white">
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
    <LegalShell title="Terms & Conditions" updated="18 September 2026">
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
          sign-in credentials secure. You must be old enough to enter a binding agreement in your
          jurisdiction, and you may not impersonate another person.
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
          Event prices are set by the organiser and shown before you register. A registration for a
          paid event is only confirmed once payment has been completed. Refunds for paid events are
          handled by the organiser under the terms shown on the event.
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
          the app.
        </p>
      </section>
    </LegalShell>
  )
}

export function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="18 September 2026">
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
            <strong>Product analytics</strong> — anonymous counts of actions such as sign-ups and
            registrations. We do not send your name, email or phone number to analytics.
          </li>
        </ul>
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
          You can delete your account at any time from Settings. We cancel your upcoming
          registrations, remove your personal details and delete your sign-in. Past attendance is
          retained only as an anonymous count so organisers keep accurate event records.
        </p>
      </section>
      <section>
        <h2>6. Storage and security</h2>
        <p>
          Data is stored in Google Firebase. Access is enforced by server-side security rules: a
          member can only read their own profile and registrations, and administrative data is
          restricted to authorised organiser accounts.
        </p>
      </section>
      <section>
        <h2>7. Contact</h2>
        <p>
          Questions about your data? Use <strong>Report a problem</strong> in Settings and we will
          get back to you.
        </p>
      </section>
    </LegalShell>
  )
}
