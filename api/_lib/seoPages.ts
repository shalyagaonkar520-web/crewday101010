import { buildEventMeta } from '../../src/seo/eventMeta.js'
import {
  buildBreadcrumbJsonLd,
  buildEventJsonLd,
  DEFAULT_SHARE_IMAGE,
  eventUrl,
  priceLabel,
  SITE_URL,
  whenText,
  type EventSeoInput,
} from '../../src/seo/eventSeo.js'
import { findPublicPage, PUBLIC_PAGES, type PublicPage } from '../../src/seo/publicPages.js'

/**
 * Server-side half of the SEO work: the same single-page app, but with the
 * title, description, canonical, structured data and a plain-HTML summary
 * already in the first response, so crawlers that never run JavaScript (the AI
 * search bots among them) still read real content.
 *
 * Events come straight from Firestore's public REST API. The security rules let
 * anyone read an event that is not a draft, so no credentials are involved and
 * nothing private can leak: a draft simply answers 403 and is treated as absent.
 */

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID?.trim() || 'crewday-2657d'
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`
const FETCH_TIMEOUT_MS = 4000
const EVENT_ID = /^[A-Za-z0-9_-]{1,128}$/

/** Shared with the CDN: fresh for 5 minutes, then served stale while it refreshes. */
const PAGE_CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=3600'
const SITEMAP_CACHE = 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400'

export interface SeoDeps {
  /** The built index.html. */
  template: () => Promise<string>
  fetchImpl: typeof fetch
  now?: () => Date
}

/* -------------------------------------------------------------------------- */
/*                               Firestore (REST)                              */
/* -------------------------------------------------------------------------- */

type RestValue = {
  stringValue?: string
  integerValue?: string
  doubleValue?: number
  booleanValue?: boolean
  timestampValue?: string
  nullValue?: null
  arrayValue?: { values?: RestValue[] }
}

interface RestDocument {
  name: string
  fields?: Record<string, RestValue>
  updateTime?: string
}

function scalar(value: RestValue | undefined): string | number | boolean | undefined {
  if (!value) return undefined
  if (value.stringValue !== undefined) return value.stringValue
  if (value.integerValue !== undefined) return Number(value.integerValue)
  if (value.doubleValue !== undefined) return value.doubleValue
  if (value.booleanValue !== undefined) return value.booleanValue
  if (value.timestampValue !== undefined) return value.timestampValue
  return undefined
}

export function documentToEvent(doc: RestDocument): EventSeoInput | null {
  const fields = doc.fields ?? {}
  const text = (key: string) => {
    const value = scalar(fields[key])
    return typeof value === 'string' ? value : undefined
  }
  const number = (key: string) => {
    const value = scalar(fields[key])
    return typeof value === 'number' ? value : undefined
  }
  const id = doc.name.split('/').pop() ?? ''
  const title = text('title')
  const date = text('date')
  if (!id || !title || !date) return null
  const isFree = scalar(fields.isFree)
  return {
    id,
    title,
    description: text('description'),
    imageURL: text('imageURL'),
    date,
    startTime: text('startTime'),
    endTime: text('endTime'),
    venue: text('venue'),
    address: text('address'),
    area: text('area'),
    city: text('city'),
    mapsURL: text('mapsURL'),
    capacity: number('capacity'),
    registeredCount: number('registeredCount'),
    price: number('price') ?? 0,
    currency: text('currency'),
    isFree: typeof isFree === 'boolean' ? isFree : undefined,
    status: text('status') ?? 'open',
    createdAt: text('createdAt') ?? null,
    updatedAt: text('updatedAt') ?? doc.updateTime ?? null,
  }
}

async function timedFetch(fetchImpl: typeof fetch, url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export type EventLookup =
  | { state: 'found'; event: EventSeoInput }
  | { state: 'missing' }
  | { state: 'error' }

export async function lookupEvent(fetchImpl: typeof fetch, id: string): Promise<EventLookup> {
  if (!EVENT_ID.test(id)) return { state: 'missing' }
  try {
    const response = await timedFetch(fetchImpl, `${DOCS}/events/${encodeURIComponent(id)}`)
    // 404: no such event. 403: a draft, which only organisers may read.
    if (response.status === 404 || response.status === 403) return { state: 'missing' }
    if (!response.ok) return { state: 'error' }
    const event = documentToEvent((await response.json()) as RestDocument)
    return event ? { state: 'found', event } : { state: 'missing' }
  } catch {
    return { state: 'error' }
  }
}

async function runEventQuery(
  fetchImpl: typeof fetch,
  filter: Record<string, unknown>,
  limit: number,
): Promise<EventSeoInput[]> {
  const response = await timedFetch(fetchImpl, `${DOCS}:runQuery`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: { from: [{ collectionId: 'events' }], where: filter, limit },
    }),
  })
  if (!response.ok) throw new Error(`Firestore answered ${response.status}`)
  const rows = (await response.json()) as { document?: RestDocument }[]
  return rows
    .map((row) => (row.document ? documentToEvent(row.document) : null))
    .filter((event): event is EventSeoInput => event !== null)
}

const statusFilter = (op: 'EQUAL' | 'IN', value: Record<string, unknown>) => ({
  fieldFilter: { field: { fieldPath: 'status' }, op, value },
})

/** Today's date in India, which is what event dates are written in. */
export function todayInIndia(now: Date): string {
  return new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10)
}

/** Open events that have not happened yet, soonest first. */
export async function upcomingEvents(fetchImpl: typeof fetch, now: Date, max = 30): Promise<EventSeoInput[]> {
  const today = todayInIndia(now)
  // Single-field filter only: no composite index needed, the date test is done here.
  const events = await runEventQuery(fetchImpl, statusFilter('EQUAL', { stringValue: 'open' }), 200)
  return events
    .filter((event) => event.date >= today)
    .sort((a, b) => `${a.date} ${a.startTime ?? ''}`.localeCompare(`${b.date} ${b.startTime ?? ''}`))
    .slice(0, max)
}

/** Every published event worth listing: not drafts, and not older than a year. */
export async function sitemapEvents(fetchImpl: typeof fetch, now: Date): Promise<EventSeoInput[]> {
  const cutoff = todayInIndia(new Date(now.getTime() - 365 * 86_400_000))
  const statuses = ['open', 'closed', 'cancelled', 'completed'].map((stringValue) => ({ stringValue }))
  const events = await runEventQuery(fetchImpl, statusFilter('IN', { arrayValue: { values: statuses } }), 1000)
  return events.filter((event) => event.date >= cutoff)
}

/* -------------------------------------------------------------------------- */
/*                                   HTML bits                                 */
/* -------------------------------------------------------------------------- */

export function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** JSON for a <script type="application/ld+json">: "<" is escaped so it cannot close the tag. */
export function jsonLdScript(data: Record<string, unknown>): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`
}

const link = (href: string, text: string) => `<a href="${esc(href)}">${esc(text)}</a>`

function eventListItem(event: EventSeoInput): string {
  const where = [event.venue, event.area].filter(Boolean).join(', ')
  const details = [whenText(event), where, priceLabel(event)].filter(Boolean).join(' · ')
  return `<li>${link(`/events/${event.id}`, event.title)}: ${esc(details)}</li>`
}

export function renderPageSnapshot(page: PublicPage, events: EventSeoInput[]): string {
  const sections = page.sections
    .map((section) => {
      const heading = section.heading ? `<h2>${esc(section.heading)}</h2>` : ''
      const paragraphs = (section.paragraphs ?? []).map((text) => `<p>${esc(text)}</p>`).join('')
      const items = section.items?.length ? `<ul>${section.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''
      return `${heading}${paragraphs}${items}`
    })
    .join('')
  const upcoming = page.listsEvents
    ? events.length
      ? `<h2>Upcoming events</h2><ul>${events.map(eventListItem).join('')}</ul>`
      : '<h2>Upcoming events</h2><p>No events are open for booking right now. Check back soon.</p>'
    : ''
  const links = page.links.length
    ? `<nav aria-label="Related pages"><ul>${page.links.map((l) => `<li>${link(l.href, l.text)}</li>`).join('')}</ul></nav>`
    : ''
  return `<main><h1>${esc(page.heading)}</h1>${sections}${upcoming}${links}</main>`
}

export function renderEventSnapshot(event: EventSeoInput): string {
  const cancelled = event.status === 'cancelled'
  const place = [event.venue, event.address, event.area, event.city].filter(Boolean).join(', ')
  const description = (event.description ?? '')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${esc(paragraph)}</p>`)
    .join('')
  return [
    '<main>',
    `<h1>${esc(event.title)}</h1>`,
    cancelled ? '<p><strong>This event was cancelled.</strong></p>' : '',
    event.status === 'completed' ? '<p>This event has already taken place.</p>' : '',
    `<p><strong>When:</strong> ${esc(whenText(event))}</p>`,
    place ? `<p><strong>Where:</strong> ${esc(place)}</p>` : '',
    `<p><strong>Price:</strong> ${esc(priceLabel(event))}</p>`,
    description,
    cancelled ? '' : `<p>${link(`/events/${event.id}/register`, 'Register for this event')}</p>`,
    `<p>${link('/explore', 'Browse more events')}</p>`,
    '</main>',
  ].join('')
}

/* -------------------------------------------------------------------------- */
/*                             Template injection                              */
/* -------------------------------------------------------------------------- */

export interface HeadValues {
  title: string
  description: string
  path: string
  image?: string
  imageAlt?: string
  noindex?: boolean
  jsonLd?: Record<string, unknown>[]
  /** Replaces the placeholder content inside #root. */
  body?: string
}

const ROOT_MARKERS = /<!--seo-root-->[\s\S]*?<!--\/seo-root-->/

function replaceTag(html: string, pattern: RegExp, tag: string): string {
  return pattern.test(html) ? html.replace(pattern, () => tag) : html
}

const metaPattern = (attr: 'name' | 'property', key: string) =>
  new RegExp(`<meta\\s+${attr}="${key.replace(/[:.]/g, '\\$&')}"[^>]*>`)

export function injectHead(template: string, values: HeadValues): string {
  const url = values.path === '/' ? `${SITE_URL}/` : `${SITE_URL}${values.path}`
  const image = values.image || DEFAULT_SHARE_IMAGE
  let html = template
  html = html.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(values.title)}</title>`)
  html = replaceTag(html, metaPattern('name', 'description'), `<meta name="description" content="${esc(values.description)}" />`)
  html = replaceTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${esc(url)}" />`)
  html = replaceTag(html, metaPattern('property', 'og:title'), `<meta property="og:title" content="${esc(values.title)}" />`)
  html = replaceTag(html, metaPattern('property', 'og:description'), `<meta property="og:description" content="${esc(values.description)}" />`)
  html = replaceTag(html, metaPattern('property', 'og:url'), `<meta property="og:url" content="${esc(url)}" />`)
  html = replaceTag(html, metaPattern('property', 'og:image'), `<meta property="og:image" content="${esc(image)}" />`)
  if (values.imageAlt) {
    html = replaceTag(html, metaPattern('property', 'og:image:alt'), `<meta property="og:image:alt" content="${esc(values.imageAlt)}" />`)
  }
  html = replaceTag(html, metaPattern('name', 'twitter:title'), `<meta name="twitter:title" content="${esc(values.title)}" />`)
  html = replaceTag(html, metaPattern('name', 'twitter:description'), `<meta name="twitter:description" content="${esc(values.description)}" />`)
  html = replaceTag(html, metaPattern('name', 'twitter:image'), `<meta name="twitter:image" content="${esc(image)}" />`)

  const extra = [
    values.noindex ? '<meta name="robots" content="noindex, nofollow" />' : '',
    ...(values.jsonLd ?? []).map(jsonLdScript),
  ].join('\n    ')
  if (extra) html = html.replace('</head>', () => `    ${extra}\n  </head>`)

  if (values.body !== undefined) {
    html = html.replace(ROOT_MARKERS, () => `<!--seo-root-->${values.body}<!--/seo-root-->`)
  }
  return html
}

/* -------------------------------------------------------------------------- */
/*                                  Handlers                                   */
/* -------------------------------------------------------------------------- */

function htmlResponse(body: string, status: number, cache: string): Response {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache },
  })
}

/**
 * GET /api/page?kind=page&slug=explore  |  ?kind=event&id=abc
 * vercel.json rewrites the public paths here. Anything unexpected falls back
 * to the plain app shell, so a failure here never takes the site down.
 */
export async function handlePageRequest(request: Request, deps: SeoDeps): Promise<Response> {
  const now = (deps.now ?? (() => new Date()))()
  const params = new URL(request.url).searchParams
  const kind = params.get('kind')
  let template: string
  try {
    template = await deps.template()
  } catch {
    return new Response('Service unavailable', { status: 503, headers: { 'cache-control': 'no-store' } })
  }

  if (kind === 'event') {
    const id = params.get('id') ?? ''
    const lookup = await lookupEvent(deps.fetchImpl, id)
    if (lookup.state === 'found') {
      const event = lookup.event
      const meta = buildEventMeta(event)
      const html = injectHead(template, {
        title: meta.title,
        description: meta.description,
        path: meta.path,
        image: meta.image,
        imageAlt: event.title,
        jsonLd: [buildEventJsonLd(event), buildBreadcrumbJsonLd(event)],
        body: renderEventSnapshot(event),
      })
      return htmlResponse(html, 200, PAGE_CACHE)
    }
    if (lookup.state === 'missing') {
      // The app still boots and shows its own "event not found" screen.
      const html = injectHead(template, {
        title: 'Event not found · CrewDay',
        description: 'This event does not exist or is no longer available.',
        path: `/events/${EVENT_ID.test(id) ? id : ''}`.replace(/\/$/, '') || '/explore',
        noindex: true,
        body: '<main><h1>Event not found</h1><p><a href="/explore">Browse events</a></p></main>',
      })
      return htmlResponse(html, 404, 'public, max-age=0, s-maxage=60')
    }
    // Firestore is unreachable: serve the app with this URL as its canonical,
    // and do not let the CDN keep the thin version.
    const html = injectHead(template, {
      title: 'Event · CrewDay',
      description: 'A small social event on CrewDay.',
      path: `/events/${id}`,
    })
    return htmlResponse(html, 200, 'no-store')
  }

  const page = findPublicPage(params.get('slug') ?? '')
  if (!page) return htmlResponse(template, 200, 'no-store')

  let events: EventSeoInput[] = []
  let degraded = false
  if (page.listsEvents) {
    try {
      events = await upcomingEvents(deps.fetchImpl, now)
    } catch {
      degraded = true
    }
  }
  const html = injectHead(template, {
    title: page.title,
    description: page.description,
    path: page.path,
    jsonLd: page.slug === 'explore' && events.length ? [itemListJsonLd(events)] : undefined,
    body: renderPageSnapshot(page, events),
  })
  return htmlResponse(html, 200, degraded ? 'no-store' : PAGE_CACHE)
}

function itemListJsonLd(events: EventSeoInput[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: events.map((event, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: eventUrl(event.id),
      name: event.title,
    })),
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Sitemap                                   */
/* -------------------------------------------------------------------------- */

const xml = (value: string) => esc(value)

export function buildSitemap(events: EventSeoInput[]): string {
  const staticUrls = [
    { loc: `${SITE_URL}/`, priority: '1.0' },
    ...PUBLIC_PAGES.map((page) => ({
      loc: `${SITE_URL}${page.path}`,
      priority: page.slug === 'explore' ? '0.9' : ['about', 'plan'].includes(page.slug) ? '0.7' : '0.3',
    })),
  ]
  const entries = [
    ...staticUrls.map((entry) => `  <url>\n    <loc>${xml(entry.loc)}</loc>\n    <priority>${entry.priority}</priority>\n  </url>`),
    ...events.map((event) => {
      const stamp = event.updatedAt ? new Date(event.updatedAt) : null
      const lastmod = stamp && !Number.isNaN(stamp.getTime()) ? `\n    <lastmod>${stamp.toISOString()}</lastmod>` : ''
      return `  <url>\n    <loc>${xml(eventUrl(event.id))}</loc>${lastmod}\n    <priority>0.8</priority>\n  </url>`
    }),
  ]
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
}

/** GET /sitemap.xml: static pages plus every published event. */
export async function handleSitemapRequest(deps: SeoDeps): Promise<Response> {
  const now = (deps.now ?? (() => new Date()))()
  let events: EventSeoInput[] = []
  let degraded = false
  try {
    events = await sitemapEvents(deps.fetchImpl, now)
  } catch {
    // Still a valid sitemap of the static pages, and not cached for long.
    degraded = true
  }
  return new Response(buildSitemap(events), {
    status: 200,
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': degraded ? 'public, max-age=0, s-maxage=60' : SITEMAP_CACHE,
    },
  })
}
