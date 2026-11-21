import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildSitemap,
  documentToEvent,
  handlePageRequest,
  handleSitemapRequest,
  injectHead,
  renderPageSnapshot,
  todayInIndia,
} from '../api/_lib/seoPages'
import { buildBreadcrumbJsonLd, buildEventJsonLd, whenText, type EventSeoInput } from '../src/seo/eventSeo'
import { findPublicPage, PUBLIC_PAGES, SEO_CITY, SEO_GRIEVANCE_REPLY_DAYS, SEO_REFUND_CUTOFF_HOURS } from '../src/seo/publicPages'
import { GRIEVANCE_REPLY_BUSINESS_DAYS, LAUNCH_CITY, REFUND_CUTOFF_HOURS } from '../src/utils/constants'

const TEMPLATE = readFileSync('index.html', 'utf8')
const NOW = new Date('2026-11-21T06:00:00Z')

type Fields = Parameters<typeof documentToEvent>[0]['fields']
const restDoc = (id: string, fields: Fields) => ({
  name: `projects/crewday-2657d/databases/(default)/documents/events/${id}`,
  updateTime: '2026-11-20T10:00:00Z',
  fields,
})
const s = (stringValue: string) => ({ stringValue })
const n = (value: number) => ({ integerValue: String(value) })

const EVENT_FIELDS: NonNullable<Fields> = {
  title: s('Sunday <b>Board</b> Game Night'),
  description: s('Come play modern board games.\n\nSnacks are available at the cafe.'),
  imageURL: s(''),
  date: s('2026-11-29'),
  startTime: s('18:00'),
  endTime: s('20:00'),
  venue: s('Meeple Cafe'),
  address: s('12 Neeladri Rd'),
  area: s('Electronic City'),
  city: s('Bengaluru'),
  mapsURL: s('https://maps.example.com/x'),
  capacity: n(10),
  registeredCount: n(3),
  price: n(99),
  currency: s('INR'),
  isFree: { booleanValue: false },
  status: s('open'),
  createdAt: { timestampValue: '2026-11-01T05:00:00Z' },
  updatedAt: { timestampValue: '2026-11-20T09:00:00Z' },
}

function event(overrides: Partial<EventSeoInput> = {}): EventSeoInput {
  return { ...documentToEvent(restDoc('evt1', EVENT_FIELDS))!, ...overrides }
}

/** A fetch that answers like Firestore's REST API for the calls the renderer makes. */
function fakeFirestore(options: { docStatus?: number; docs?: ReturnType<typeof restDoc>[]; queryStatus?: number } = {}) {
  const calls: string[] = []
  const impl = (async (input: RequestInfo | URL) => {
    const url = String(input)
    calls.push(url)
    if (url.includes(':runQuery')) {
      if (options.queryStatus && options.queryStatus !== 200) return new Response('x', { status: options.queryStatus })
      return Response.json((options.docs ?? []).map((document) => ({ document })))
    }
    if (options.docStatus && options.docStatus !== 200) return new Response('x', { status: options.docStatus })
    return Response.json((options.docs ?? [restDoc('evt1', EVENT_FIELDS)])[0])
  }) as typeof fetch
  return { impl, calls }
}

const request = (path: string) => new Request(`https://crewday.nirmaansolutions.in${path}`)
const deps = (fetchImpl: typeof fetch) => ({ template: async () => TEMPLATE, fetchImpl, now: () => NOW })

describe('Firestore REST parsing', () => {
  it('turns a REST document into an event', () => {
    const parsed = documentToEvent(restDoc('evt1', EVENT_FIELDS))!
    expect(parsed).toMatchObject({ id: 'evt1', price: 99, capacity: 10, registeredCount: 3, isFree: false, city: 'Bengaluru' })
    expect(parsed.createdAt).toBe('2026-11-01T05:00:00Z')
  })

  it('rejects a document without a title or date', () => {
    expect(documentToEvent(restDoc('x', { title: s('Only a title') }))).toBeNull()
  })
})

describe('event structured data', () => {
  it('builds a schema.org Event from the event and nothing else', () => {
    const ld = buildEventJsonLd(event()) as Record<string, any>
    expect(ld['@type']).toBe('Event')
    expect(ld.startDate).toBe('2026-11-29T18:00:00+05:30')
    expect(ld.endDate).toBe('2026-11-29T20:00:00+05:30')
    expect(ld.eventStatus).toBe('https://schema.org/EventScheduled')
    expect(ld.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode')
    expect(ld.location).toMatchObject({
      '@type': 'Place',
      name: 'Meeple Cafe',
      hasMap: 'https://maps.example.com/x',
      address: { streetAddress: '12 Neeladri Rd', addressLocality: 'Bengaluru', addressRegion: 'Karnataka', addressCountry: 'IN' },
    })
    expect(ld.offers).toMatchObject({
      price: 99,
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: 'https://crewday.nirmaansolutions.in/events/evt1',
      validFrom: '2026-11-01T05:00:00Z',
    })
    expect(ld.organizer).toEqual({ '@type': 'Organization', name: 'CrewDay', url: 'https://crewday.nirmaansolutions.in' })
    expect(ld.image).toEqual(['https://crewday.nirmaansolutions.in/og/crewday-share.png'])
    expect(ld.performer).toBeUndefined()
  })

  it('marks cancelled events, sold-out events and free events correctly', () => {
    expect((buildEventJsonLd(event({ status: 'cancelled' })) as any).eventStatus).toBe('https://schema.org/EventCancelled')
    expect((buildEventJsonLd(event({ registeredCount: 10 })) as any).offers.availability).toBe('https://schema.org/SoldOut')
    expect((buildEventJsonLd(event({ isFree: true, price: 0 })) as any).offers.price).toBe(0)
  })

  it('leaves out what Firestore does not have instead of inventing it', () => {
    const ld = buildEventJsonLd(event({ endTime: undefined, mapsURL: '', city: 'Mysuru', createdAt: null })) as any
    expect(ld.endDate).toBeUndefined()
    expect(ld.location.hasMap).toBeUndefined()
    expect(ld.location.address.addressRegion).toBeUndefined()
    expect(ld.offers.validFrom).toBeUndefined()
  })

  it('caps the description at 500 characters', () => {
    expect((buildEventJsonLd(event({ description: 'word '.repeat(300) })) as any).description.length).toBeLessThanOrEqual(500)
  })

  it('builds a Home › Explore › Event breadcrumb', () => {
    const items = (buildBreadcrumbJsonLd(event()) as any).itemListElement
    expect(items.map((item: any) => item.name)).toEqual(['Home', 'Explore', 'Sunday <b>Board</b> Game Night'])
    expect(items[2].item).toBe('https://crewday.nirmaansolutions.in/events/evt1')
  })

  it('writes the date and time in words', () => {
    expect(whenText({ date: '2026-11-29', startTime: '18:00', endTime: '20:00' })).toBe('Sunday 29 November 2026, 6:00–8:00 PM')
    expect(whenText({ date: '2026-11-29', startTime: '11:00', endTime: '13:30' })).toBe('Sunday 29 November 2026, 11:00 AM – 1:30 PM')
    expect(whenText({ date: '2026-11-29' })).toBe('Sunday 29 November 2026')
  })
})

describe('head injection', () => {
  it('replaces every tag in the real index.html', () => {
    const html = injectHead(TEMPLATE, {
      title: 'T "quoted" & more',
      description: 'D <script>',
      path: '/explore',
      image: 'https://img.example.com/a.png',
      noindex: true,
      jsonLd: [{ '@type': 'Thing', name: '</script><b>' }],
      body: '<main><h1>Hi</h1></main>',
    })
    expect(html).toContain('<title>T &quot;quoted&quot; &amp; more</title>')
    expect(html).toContain('<meta name="description" content="D &lt;script&gt;" />')
    expect(html).toContain('<link rel="canonical" href="https://crewday.nirmaansolutions.in/explore" />')
    expect(html).toContain('<meta property="og:url" content="https://crewday.nirmaansolutions.in/explore" />')
    expect(html).toContain('<meta property="og:image" content="https://img.example.com/a.png" />')
    expect(html).toContain('<meta name="twitter:image" content="https://img.example.com/a.png" />')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />')
    expect(html).toContain('<main><h1>Hi</h1></main>')
    expect(html.match(/<link rel="canonical"/g)).toHaveLength(1)
    expect(html.match(/<title>/g)).toHaveLength(1)
    // "</script>" inside JSON-LD must not be able to close the tag.
    const ld = html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/g) ?? []
    expect(ld.some((block) => block.includes('\\u003c/script>'))).toBe(true)
    expect(html).toContain('<div id="root"><!--seo-root--><main><h1>Hi</h1></main><!--/seo-root--></div>')
  })

  it('keeps the app entry point intact', () => {
    const html = injectHead(TEMPLATE, { title: 'x', description: 'y', path: '/about', body: '<main></main>' })
    expect(html).toContain('<script type="module" src="/src/main.tsx"></script>')
    expect(html).toContain('id="splash"')
  })
})

describe('page and event responses', () => {
  it('serves an event with its title, JSON-LD and readable text in the first response', async () => {
    const { impl } = fakeFirestore()
    const response = await handlePageRequest(request('/api/page?kind=event&id=evt1'), deps(impl))
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('s-maxage=300')
    expect(html).toContain('<h1>Sunday &lt;b&gt;Board&lt;/b&gt; Game Night</h1>')
    expect(html).toContain('Sunday 29 November 2026, 6:00–8:00 PM')
    expect(html).toContain('Meeple Cafe, 12 Neeladri Rd, Electronic City, Bengaluru')
    expect(html).toContain('<strong>Price:</strong> ₹99')
    expect(html).toContain('href="/events/evt1/register"')
    expect(html).toContain('"@type":"Event"')
    expect(html).toContain('"@type":"BreadcrumbList"')
    expect(html).toContain('<link rel="canonical" href="https://crewday.nirmaansolutions.in/events/evt1" />')
    expect(html).not.toContain('noindex')
  })

  it('keeps a cancelled event online and says so', async () => {
    const { impl } = fakeFirestore({ docs: [restDoc('evt1', { ...EVENT_FIELDS, status: s('cancelled') })] })
    const response = await handlePageRequest(request('/api/page?kind=event&id=evt1'), deps(impl))
    const html = await response.text()
    expect(response.status).toBe(200)
    expect(html).toContain('This event was cancelled.')
    expect(html).toContain('EventCancelled')
    expect(html).not.toContain('Register for this event')
  })

  it('answers 404 with noindex for a missing event and for a draft (403)', async () => {
    for (const docStatus of [404, 403]) {
      const response = await handlePageRequest(request('/api/page?kind=event&id=evt1'), deps(fakeFirestore({ docStatus }).impl))
      expect(response.status).toBe(404)
      expect(await response.text()).toContain('noindex')
    }
  })

  it('never queries Firestore for a malformed event id', async () => {
    const { impl, calls } = fakeFirestore()
    const response = await handlePageRequest(request('/api/page?kind=event&id=../users/x'), deps(impl))
    expect(response.status).toBe(404)
    expect(calls).toHaveLength(0)
  })

  it('still serves the app, uncached, when Firestore is down', async () => {
    const response = await handlePageRequest(request('/api/page?kind=event&id=evt1'), deps(fakeFirestore({ docStatus: 500 }).impl))
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.text()).toContain('id="splash"')
  })

  it('lists upcoming open events on /explore as plain links, soonest first, skipping past ones', async () => {
    const docs = [
      restDoc('later', { ...EVENT_FIELDS, title: s('Later'), date: s('2026-12-20') }),
      restDoc('past', { ...EVENT_FIELDS, title: s('Past'), date: s('2026-10-01') }),
      restDoc('soon', { ...EVENT_FIELDS, title: s('Soon'), date: s('2026-11-25') }),
    ]
    const response = await handlePageRequest(request('/api/page?kind=page&slug=explore'), deps(fakeFirestore({ docs }).impl))
    const html = await response.text()
    expect(html).toContain('<h1>Discover events in Bengaluru</h1>')
    expect(html).toContain('<a href="/events/soon">Soon</a>')
    expect(html).not.toContain('Past</a>')
    expect(html.indexOf('/events/soon')).toBeLessThan(html.indexOf('/events/later'))
    expect(html).toContain('"@type":"ItemList"')
  })

  it('serves the other public pages with their own copy and a canonical', async () => {
    const response = await handlePageRequest(request('/api/page?kind=page&slug=refund-policy'), deps(fakeFirestore().impl))
    const html = await response.text()
    expect(html).toContain('<title>Refund &amp; Cancellation Policy · CrewDay Bengaluru</title>')
    expect(html).toContain('<h1>Refund &amp; Cancellation Policy</h1>')
    expect(html).toContain('full refund')
    expect(html).toContain('https://crewday.nirmaansolutions.in/refund-policy')
  })

  it('falls back to the plain app for an unknown slug', async () => {
    const response = await handlePageRequest(request('/api/page?kind=page&slug=nope'), deps(fakeFirestore().impl))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe(TEMPLATE)
  })

  it('answers 503 rather than a broken page when the template cannot be read', async () => {
    const response = await handlePageRequest(request('/api/page?kind=page&slug=about'), {
      template: async () => {
        throw new Error('missing')
      },
      fetchImpl: fakeFirestore().impl,
    })
    expect(response.status).toBe(503)
  })
})

describe('sitemap', () => {
  it('lists the static pages and every published event with lastmod', async () => {
    const docs = [
      restDoc('a', EVENT_FIELDS),
      restDoc('old', { ...EVENT_FIELDS, date: s('2025-01-01') }),
    ]
    const response = await handleSitemapRequest(deps(fakeFirestore({ docs }).impl))
    const xml = await response.text()
    expect(response.headers.get('content-type')).toContain('application/xml')
    expect(xml).toContain('<loc>https://crewday.nirmaansolutions.in/</loc>')
    for (const page of PUBLIC_PAGES) expect(xml).toContain(`<loc>https://crewday.nirmaansolutions.in${page.path}</loc>`)
    expect(xml).toContain('<loc>https://crewday.nirmaansolutions.in/events/a</loc>')
    expect(xml).toContain('<lastmod>2026-11-20T09:00:00.000Z</lastmod>')
    expect(xml).not.toContain('/events/old')
  })

  it('still returns a valid sitemap of the static pages if Firestore fails', async () => {
    const response = await handleSitemapRequest(deps(fakeFirestore({ queryStatus: 500 }).impl))
    const xml = await response.text()
    expect(response.status).toBe(200)
    expect(xml).toContain('<urlset')
    expect(xml).not.toContain('/events/')
  })

  it('escapes anything that reaches the XML', () => {
    expect(buildSitemap([event({ id: 'a&b' })])).toContain('events/a&amp;b')
  })
})

describe('shared page copy', () => {
  it('mirrors the numbers in src/utils/constants.ts', () => {
    expect(SEO_CITY).toBe(LAUNCH_CITY)
    expect(SEO_REFUND_CUTOFF_HOURS).toBe(REFUND_CUTOFF_HOURS)
    expect(SEO_GRIEVANCE_REPLY_DAYS).toBe(GRIEVANCE_REPLY_BUSINESS_DAYS)
  })

  it('renders exactly one h1 per page and escapes its text', () => {
    for (const page of PUBLIC_PAGES) {
      const html = renderPageSnapshot(page, [])
      expect(html.match(/<h1>/g), page.slug).toHaveLength(1)
    }
    expect(findPublicPage('explore')?.listsEvents).toBe(true)
  })

  it('computes today in India, not in UTC', () => {
    expect(todayInIndia(new Date('2026-11-20T20:00:00Z'))).toBe('2026-11-21')
  })
})
