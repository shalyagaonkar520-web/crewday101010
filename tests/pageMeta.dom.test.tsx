import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { RouteMeta } from '@/seo/routeMeta'

const SITE = 'https://crewday.nirmaansolutions.in'
const DEFAULT_TITLE = 'CrewDay default'

const content = (selector: string) => document.head.querySelector(selector)?.getAttribute('content')
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')

beforeEach(() => {
  document.head.innerHTML = `
    <title>${DEFAULT_TITLE}</title>
    <meta name="description" content="default description" />
    <link rel="canonical" href="${SITE}/" />
    <meta property="og:title" content="default og title" />
  `
})

afterEach(() => {
  cleanup()
  document.head.innerHTML = ''
})

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteMeta />
    </MemoryRouter>,
  )
}

describe('page head tags', () => {
  it('sets title, description, canonical and social tags for a public route', () => {
    renderAt('/refund-policy')
    expect(document.title).toBe('Refund & Cancellation Policy · CrewDay Bengaluru')
    expect(content('meta[name="description"]')).toContain('full refund')
    expect(canonical()).toBe(`${SITE}/refund-policy`)
    expect(content('meta[property="og:title"]')).toBe(document.title)
    expect(content('meta[property="og:url"]')).toBe(`${SITE}/refund-policy`)
    expect(content('meta[name="twitter:title"]')).toBe(document.title)
    expect(content('meta[property="og:image"]')).toBe(`${SITE}/og/crewday-share.png`)
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
  })

  it('adds noindex on private routes', () => {
    renderAt('/my-events')
    expect(content('meta[name="robots"]')).toBe('noindex, nofollow')
  })

  it('canonicalises to the public host, never the host the page is served from', () => {
    renderAt('/explore')
    expect(canonical()?.startsWith(SITE)).toBe(true)
  })

  it('puts every default back when the page unmounts', () => {
    const view = renderAt('/my-events')
    view.unmount()
    expect(document.title).toBe(DEFAULT_TITLE)
    expect(content('meta[name="description"]')).toBe('default description')
    expect(canonical()).toBe(`${SITE}/`)
    expect(content('meta[property="og:title"]')).toBe('default og title')
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull()
    expect(document.head.querySelector('meta[name="twitter:title"]')).toBeNull()
  })

  it('does nothing on a route that sets its own tags', () => {
    renderAt('/events/abc')
    expect(document.title).toBe(DEFAULT_TITLE)
  })
})
