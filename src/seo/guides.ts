/**
 * Editorial guides (/guides/:slug) and the FAQ page (/faq).
 *
 * The copy is written in Markdown (content/seo/) and turned into
 * content.generated.ts by `npm run seo:content`. Both the browser and the
 * server (api/page.ts) read that one file, so the visible page, the
 * pre-rendered HTML and the FAQPage structured data can never disagree, which
 * is what Google requires of FAQ markup.
 *
 * Text may contain two bits of inline markup: **bold** and [links](/path).
 * Everything else is plain text. Relative imports only: the server imports this.
 */
import { FAQ_PAGE_CONTENT, GUIDE_CONTENT } from './content.generated.js'

export const SITE_ORIGIN = 'https://crewday.nirmaansolutions.in'

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqGroup {
  /** Category heading on the FAQ page; guides have a single unnamed group. */
  heading?: string
  items: FaqItem[]
}

export interface GuideSection {
  heading?: string
  paragraphs?: string[]
  items?: string[]
}

export interface GuideContent {
  slug: string
  /** Title tag, under 60 characters. */
  title: string
  /** Meta description, under 155 characters. */
  description: string
  /** The page's single h1. */
  heading: string
  /** The 2 to 3 sentence direct answer that opens the page. */
  answer: string[]
  sections: GuideSection[]
  faqs: FaqGroup[]
  /** YYYY-MM-DD, shown on the page and used as dateModified. */
  updated?: string
}

export const GUIDES: GuideContent[] = GUIDE_CONTENT
export const FAQ_PAGE: GuideContent | null = FAQ_PAGE_CONTENT

export const guidePath = (slug: string) => `/guides/${slug}`

/* -------------------------------------------------------------------------- */
/*                                Inline markup                                */
/* -------------------------------------------------------------------------- */

export type InlinePart =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'link'; text: string; href: string }

const INLINE = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g

/** Only site-relative paths and https links are kept as links. */
export function safeHref(href: string): string | null {
  if (href.startsWith('/') && !href.startsWith('//')) return href
  if (href.startsWith(`${SITE_ORIGIN}/`)) return href.slice(SITE_ORIGIN.length)
  return /^https:\/\/[^\s"'<>]+$/.test(href) ? href : null
}

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = []
  let last = 0
  for (const match of text.matchAll(INLINE)) {
    const index = match.index ?? 0
    if (index > last) parts.push({ kind: 'text', text: text.slice(last, index) })
    if (match[1] !== undefined) {
      parts.push({ kind: 'bold', text: match[1] })
    } else {
      const href = safeHref(match[3])
      parts.push(href ? { kind: 'link', text: match[2], href } : { kind: 'text', text: match[2] })
    }
    last = index + match[0].length
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) })
  return parts
}

/** The text without markup, for meta tags and structured data. */
export function plainInline(text: string): string {
  return parseInline(text)
    .map((part) => part.text)
    .join('')
}

/* -------------------------------------------------------------------------- */
/*                               Structured data                               */
/* -------------------------------------------------------------------------- */

export function pageUrl(path: string): string {
  return `${SITE_ORIGIN}${path}`
}

/** schema.org FAQPage built from exactly the questions shown on the page. */
export function buildFaqJsonLd(faqs: FaqGroup[], path: string): Record<string, unknown> | null {
  const items = faqs.flatMap((group) => group.items)
  if (!items.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': `${pageUrl(path)}#faq`,
    url: pageUrl(path),
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: plainInline(item.question),
      acceptedAnswer: { '@type': 'Answer', text: plainInline(item.answer) },
    })),
  }
}

/** schema.org Article for a guide. Only fields the content actually has. */
export function buildArticleJsonLd(guide: GuideContent): Record<string, unknown> {
  const path = guidePath(guide.slug)
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.heading,
    description: guide.description,
    url: pageUrl(path),
    mainEntityOfPage: pageUrl(path),
    ...(guide.updated ? { dateModified: guide.updated } : {}),
    author: { '@type': 'Organization', name: 'CrewDay', url: SITE_ORIGIN },
    publisher: { '@type': 'Organization', name: 'CrewDay', url: SITE_ORIGIN },
  }
}
