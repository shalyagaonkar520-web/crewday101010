import { useEffect } from 'react'
import { DEFAULT_SHARE_IMAGE, SITE_URL } from '@/utils/constants'

export interface PageMeta {
  /** Full document title, already in "Page name · CrewDay Bengaluru" form. */
  title: string
  description: string
  /** Path on the site, e.g. "/explore". Becomes the canonical and og:url. */
  path: string
  /** Absolute image URL; falls back to the default share card. */
  image?: string
  /** Keep the page out of search results (account, ticket and admin pages). */
  noindex?: boolean
}

type Restore = () => void

/**
 * Point a <meta>/<link> at a value and hand back a function that undoes it.
 * Existing tags (the defaults from index.html) are put back exactly as they
 * were; tags created here are removed again.
 */
function setTag(selector: string, create: () => HTMLElement, attr: string, value: string): Restore {
  let element = document.head.querySelector<HTMLElement>(selector)
  const created = !element
  if (!element) {
    element = create()
    document.head.appendChild(element)
  }
  const previous = element.getAttribute(attr)
  element.setAttribute(attr, value)
  return () => {
    if (created) element?.remove()
    else if (previous === null) element?.removeAttribute(attr)
    else element?.setAttribute(attr, previous)
  }
}

const metaByName = (name: string, content: string) =>
  setTag(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name }), 'content', content)

const metaByProperty = (property: string, content: string) =>
  setTag(
    `meta[property="${property}"]`,
    () => {
      const element = document.createElement('meta')
      element.setAttribute('property', property)
      return element
    },
    'content',
    content,
  )

export function canonicalUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}

/**
 * Per-route head tags for a single-page app: title, description, canonical,
 * Open Graph and Twitter cards, plus an optional noindex. Everything is put
 * back to the index.html defaults when the page unmounts, so a route that sets
 * nothing never inherits another page's tags.
 */
export function usePageMeta({ title, description, path, image, noindex = false }: PageMeta): void {
  useEffect(() => {
    const url = canonicalUrl(path)
    const picture = image || DEFAULT_SHARE_IMAGE
    const previousTitle = document.title
    document.title = title

    const restores: Restore[] = [
      metaByName('description', description),
      setTag('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', url),
      metaByProperty('og:title', title),
      metaByProperty('og:description', description),
      metaByProperty('og:url', url),
      metaByProperty('og:image', picture),
      metaByName('twitter:title', title),
      metaByName('twitter:description', description),
      metaByName('twitter:image', picture),
    ]
    if (noindex) restores.push(metaByName('robots', 'noindex, nofollow'))

    return () => {
      document.title = previousTitle
      restores.reverse().forEach((restore) => restore())
    }
  }, [title, description, path, image, noindex])
}
