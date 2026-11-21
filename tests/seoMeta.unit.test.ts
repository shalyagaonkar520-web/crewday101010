import { describe, expect, it } from 'vitest'
import { buildEventMeta } from '@/seo/eventMeta'
import { findRouteMeta, ROUTE_META } from '@/seo/routeMeta'
import type { CrewEvent } from '@/types'

const PUBLIC_PATHS = [
  '/explore',
  '/about',
  '/plan',
  '/terms',
  '/privacy',
  '/refund-policy',
  '/shipping-policy',
  '/contact',
  '/delete-account',
]

const PRIVATE_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/admin',
  '/admin/events/abc/attendees',
  '/home',
  '/profile',
  '/settings',
  '/settings/profile',
  '/tickets/event-1__user-1',
  '/my-events',
  '/purchases',
  '/notifications',
  '/registration/event-1__user-1',
  '/onboarding',
  '/suggest',
  '/events/abc/register',
]

function event(overrides: Partial<CrewEvent> = {}): CrewEvent {
  return {
    id: 'evt1',
    title: 'Sunday Board Game Night',
    description: 'Come play modern board games with new people. Snacks are available at the cafe.',
    imageURL: 'https://example.com/pic.jpg',
    date: '2026-11-30',
    startTime: '18:00',
    venue: 'Meeple Cafe',
    area: 'Electronic City',
    city: 'Bengaluru',
    price: 99,
    currency: 'INR',
    isFree: false,
    status: 'open',
    ...overrides,
  } as CrewEvent
}

describe('route head copy', () => {
  it('gives every public page a title under 60 and a description under 155 characters', () => {
    for (const path of PUBLIC_PATHS) {
      const meta = findRouteMeta(path)
      expect(meta, path).not.toBeNull()
      expect(meta!.noindex, path).toBeFalsy()
      expect(meta!.title.length, `${path} title`).toBeLessThanOrEqual(60)
      expect(meta!.description.length, `${path} description`).toBeLessThanOrEqual(155)
      expect(meta!.title, path).toContain('CrewDay')
    }
  })

  it('uses a different title and description on every public page', () => {
    const metas = PUBLIC_PATHS.map((path) => findRouteMeta(path)!)
    expect(new Set(metas.map((meta) => meta.title)).size).toBe(metas.length)
    expect(new Set(metas.map((meta) => meta.description)).size).toBe(metas.length)
  })

  it('marks every account, ticket and admin route noindex', () => {
    for (const path of PRIVATE_PATHS) {
      expect(findRouteMeta(path)?.noindex, path).toBe(true)
    }
  })

  it('leaves the event page and unknown paths to their own components', () => {
    expect(findRouteMeta('/events/abc')).toBeNull()
    expect(findRouteMeta('/no-such-page')).toBeNull()
  })

  it('has no pattern shadowed by an earlier one', () => {
    const seen = new Set<string>()
    for (const entry of ROUTE_META) {
      expect(seen.has(entry.pattern), entry.pattern).toBe(false)
      seen.add(entry.pattern)
    }
  })
})

describe('event head copy', () => {
  it('builds "title · day · price · CrewDay" and a description with venue and area', () => {
    const meta = buildEventMeta(event())
    expect(meta.title).toBe('Sunday Board Game Night · Mon 30 Nov · ₹99 · CrewDay')
    expect(meta.description).toBe(
      'Come play modern board games with new people. Meeple Cafe, Electronic City.',
    )
    expect(meta.path).toBe('/events/evt1')
    expect(meta.image).toBe('https://example.com/pic.jpg')
    expect(meta.noindex).toBe(false)
  })

  it('shortens a long title so the whole title stays within 60 characters', () => {
    const meta = buildEventMeta(
      event({ title: 'An unusually long event title that would otherwise push past the display limit' }),
    )
    expect(meta.title.length).toBeLessThanOrEqual(60)
    expect(meta.title.endsWith('· CrewDay')).toBe(true)
  })

  it('says Free for free events and caps a long description at 155 characters', () => {
    const meta = buildEventMeta(event({ isFree: true, price: 0, description: 'x'.repeat(400) }))
    expect(meta.title).toContain('Free')
    expect(meta.description.length).toBeLessThanOrEqual(155)
  })

  it('falls back to the default share card when the event has no usable image', () => {
    expect(buildEventMeta(event({ imageURL: '' })).image).toBeUndefined()
    expect(buildEventMeta(event({ imageURL: 'data:image/png;base64,AAAA' })).image).toBeUndefined()
  })

  it('never lets a draft be indexed', () => {
    expect(buildEventMeta(event({ status: 'draft' })).noindex).toBe(true)
  })
})
