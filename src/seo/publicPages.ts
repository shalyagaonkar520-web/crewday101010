/**
 * Copy for every public page: the head tags (title, description) and a short
 * plain-HTML summary that crawlers get in the first response, before any
 * JavaScript runs.
 *
 * One source for both sides: the browser (src/seo/routeMeta.tsx) and the
 * server (api/page.ts). Relative imports only. The three numbers below mirror
 * src/utils/constants.ts and are checked against it in tests/seoPages.unit.test.ts.
 */

import { FAQ_PAGE, GUIDES, guidePath, type FaqGroup, type GuideContent } from './guides.js'

export const SEO_CITY = 'Bengaluru'
export const SEO_REFUND_CUTOFF_HOURS = 24
export const SEO_GRIEVANCE_REPLY_DAYS = 5

const suffix = `CrewDay ${SEO_CITY}`

export interface SnapshotSection {
  heading?: string
  paragraphs?: string[]
  items?: string[]
}

export interface PublicPage {
  /** URL slug used by the rewrite in vercel.json; "home" is the root. */
  slug: string
  path: string
  title: string
  description: string
  /** The page's single h1. */
  heading: string
  sections: SnapshotSection[]
  /** Internal links worth following from this page. */
  links: { href: string; text: string }[]
  /** The server fills in the upcoming events here. */
  listsEvents?: boolean
  /** Questions shown on the page and published as FAQPage structured data. */
  faqs?: FaqGroup[]
  /** Set for editorial guides: adds Article structured data. */
  guide?: GuideContent
}

const policyLinks = [
  { href: '/terms', text: 'Terms & Conditions' },
  { href: '/privacy', text: 'Privacy Policy' },
  { href: '/refund-policy', text: 'Refund & Cancellation Policy' },
  { href: '/shipping-policy', text: 'Delivery Policy' },
  { href: '/contact', text: 'Contact & Grievances' },
]

export const PUBLIC_PAGES: PublicPage[] = [
  {
    slug: 'explore',
    path: '/explore',
    title: `Explore events · ${suffix}`,
    description: `Browse small social events in ${SEO_CITY}: game nights, walks, café meet-ups and workshops from ₹49. Book a seat in minutes and meet new people.`,
    heading: `Discover events in ${SEO_CITY}`,
    sections: [
      {
        paragraphs: [
          `CrewDay lists small social events in ${SEO_CITY}: game nights, walks, café meet-ups, workshops and sports. Pick one, book a seat, pay by UPI or online, and show the QR ticket at the venue.`,
        ],
      },
    ],
    links: [
      { href: '/plan', text: 'Plan my CrewDay' },
      { href: '/about', text: 'About CrewDay' },
    ],
    listsEvents: true,
  },
  {
    slug: 'about',
    path: '/about',
    title: `About us · ${suffix}`,
    description: `CrewDay helps people new to ${SEO_CITY} make friends offline through small, friendly events that cost ₹49–₹99. See who it is for and how it works.`,
    heading: 'Find your crew. Make your day.',
    sections: [
      {
        paragraphs: [
          `Work is only one part of life. CrewDay helps you discover people, hobbies, activities and events happening around you in ${SEO_CITY}, every weekend.`,
          'You can join an event as a participant or as audience. Organisers create events, set the price and capacity, and check people in by scanning QR tickets.',
        ],
      },
      {
        heading: 'How booking works',
        items: [
          'Browse events and register for a seat. Some events are free; paid events are priced by the organiser.',
          'Pay by UPI directly to the organiser, or online through Razorpay.',
          'Your ticket is a QR code in the app, under My events.',
          `Cancel at least ${SEO_REFUND_CUTOFF_HOURS} hours before the event for a full refund.`,
        ],
      },
    ],
    links: [{ href: '/explore', text: 'Explore events' }, ...policyLinks.slice(2)],
  },
  {
    slug: 'plan',
    path: '/plan',
    title: `Plan my CrewDay · ${suffix}`,
    description: `Answer a few quick questions and get small ${SEO_CITY} events matched to your mood, budget and free time. Events from ₹49.`,
    heading: 'Plan my CrewDay',
    sections: [
      {
        paragraphs: [
          `Answer a few quick questions about your mood, budget and free time, and CrewDay suggests ${SEO_CITY} events that fit. Open to guests, no account needed.`,
        ],
      },
    ],
    links: [{ href: '/explore', text: 'Explore events' }],
  },
  {
    slug: 'terms',
    path: '/terms',
    title: `Terms & Conditions · ${suffix}`,
    description: `The terms for using CrewDay: accounts, bookings, payments, organisers and conduct at events in ${SEO_CITY}.`,
    heading: 'Terms & Conditions',
    sections: [
      {
        paragraphs: [
          'The terms for using CrewDay: your account (you must be at least 18), event registrations and payments, the organiser’s role, and how people are expected to behave at events.',
        ],
      },
    ],
    links: policyLinks.filter((link) => link.href !== '/terms'),
  },
  {
    slug: 'privacy',
    path: '/privacy',
    title: `Privacy Policy · ${suffix}`,
    description:
      'What CrewDay collects, why, who can see it and how to delete your data. Covers the CrewDay website and the Android app.',
    heading: 'Privacy Policy',
    sections: [
      {
        paragraphs: [
          'What CrewDay collects, why, who can see it, and how you can have it deleted. It applies to the CrewDay website and the Android app, which share one account.',
          'Card, UPI and bank details are never stored by CrewDay: online payments are handled by Razorpay, and UPI payments happen in your own UPI app.',
        ],
      },
    ],
    links: [
      { href: '/delete-account', text: 'Delete your account' },
      ...policyLinks.filter((link) => link.href !== '/privacy'),
    ],
  },
  {
    slug: 'refund-policy',
    path: '/refund-policy',
    title: `Refund & Cancellation Policy · ${suffix}`,
    description: `Cancel at least ${SEO_REFUND_CUTOFF_HOURS} hours before an event for a full refund. Events cancelled by the organiser are refunded in full. How refunds are paid.`,
    heading: 'Refund & Cancellation Policy',
    sections: [
      {
        heading: 'Cancelling your registration',
        items: [
          `Cancel at least ${SEO_REFUND_CUTOFF_HOURS} hours before the event starts and you get a full refund of the ticket price.`,
          `Cancellations less than ${SEO_REFUND_CUTOFF_HOURS} hours before the start, and no-shows, are not refunded.`,
          'Free events can be cancelled at any time.',
        ],
      },
      {
        heading: 'When the organiser cancels',
        items: ['If an event is cancelled, you get a full refund automatically.'],
      },
      {
        heading: 'How refunds are paid',
        items: [
          'Refunds go back to the original payment method through Razorpay.',
          'If you paid the organiser directly by UPI, the organiser returns the money to the same UPI account.',
        ],
      },
    ],
    links: policyLinks.filter((link) => link.href !== '/refund-policy'),
  },
  {
    slug: 'shipping-policy',
    path: '/shipping-policy',
    title: `Delivery Policy · ${suffix}`,
    description:
      'Nothing is shipped. Your CrewDay ticket is delivered instantly in the app as a QR code once your registration is confirmed.',
    heading: 'Delivery Policy',
    sections: [
      {
        paragraphs: [
          'CrewDay sells registrations for events, not physical goods, so nothing is shipped and there is no shipping charge.',
          'Your ticket is delivered in the app, under My events, as soon as your registration is confirmed. Show the QR code at the venue to check in.',
        ],
      },
    ],
    links: policyLinks.filter((link) => link.href !== '/shipping-policy'),
  },
  {
    slug: 'contact',
    path: '/contact',
    title: `Contact & Grievances · ${suffix}`,
    description: `Contact CrewDay for booking, payment or refund help, or raise a grievance. We reply within ${SEO_GRIEVANCE_REPLY_DAYS} business days.`,
    heading: 'Contact & Grievances',
    sections: [
      {
        paragraphs: [
          `Contact CrewDay for booking, payment or refund help, or to raise a grievance. We reply within ${SEO_GRIEVANCE_REPLY_DAYS} business days.`,
        ],
      },
    ],
    links: policyLinks.filter((link) => link.href !== '/contact'),
  },
  {
    slug: 'delete-account',
    path: '/delete-account',
    title: `Delete your account · ${suffix}`,
    description:
      'How to delete your CrewDay account and what happens to your data. Works for the website and the Android app.',
    heading: 'Delete your CrewDay account',
    sections: [
      {
        heading: 'Delete it yourself',
        items: [
          'Open CrewDay (the app or the website) and sign in.',
          'Go to Settings and choose Delete account.',
          'Confirm with your password or Google account and type DELETE.',
        ],
      },
      {
        paragraphs: [
          'Deletion is immediate. Your upcoming registrations are cancelled, and your name, email and phone number are erased from your profile and tickets.',
        ],
      },
    ],
    links: [{ href: '/privacy', text: 'Privacy Policy' }],
  },
]

/* Guides and the FAQ: copy comes from content/seo/ via guides.ts. */

function contentPage(content: GuideContent, slug: string, path: string, links: PublicPage['links']): PublicPage {
  return {
    slug,
    path,
    title: content.title,
    description: content.description,
    heading: content.heading,
    // The direct answer comes first, straight under the h1.
    sections: [{ paragraphs: content.answer }, ...content.sections],
    links,
    faqs: content.faqs,
  }
}

export const GUIDE_PAGES: PublicPage[] = GUIDES.map((guide) => ({
  ...contentPage(guide, `guides/${guide.slug}`, guidePath(guide.slug), [
    { href: '/explore', text: 'Explore events' },
    ...(FAQ_PAGE ? [{ href: '/faq', text: 'CrewDay FAQ' }] : []),
  ]),
  guide,
}))

export const FAQ_PUBLIC_PAGE: PublicPage | null = FAQ_PAGE
  ? contentPage(FAQ_PAGE, 'faq', '/faq', [
      { href: '/explore', text: 'Explore events' },
      { href: '/about', text: 'About CrewDay' },
      ...GUIDES.map((guide) => ({ href: guidePath(guide.slug), text: guide.heading })),
    ])
  : null

PUBLIC_PAGES.push(...GUIDE_PAGES, ...(FAQ_PUBLIC_PAGE ? [FAQ_PUBLIC_PAGE] : []))

/** The home page ("/") is served as a static file, so it is not in the table above. */
export const HOME_SNAPSHOT = {
  heading: `CrewDay: meet new people in ${SEO_CITY}`,
  paragraph: `CrewDay lists small social events in ${SEO_CITY} (game nights, walks, café meet-ups, workshops) that people new to the city, or anyone who wants friends offline, can join from ₹49.`,
}

export function findPublicPage(slug: string): PublicPage | undefined {
  return PUBLIC_PAGES.find((page) => page.slug === slug)
}
