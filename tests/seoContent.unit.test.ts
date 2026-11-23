import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { handlePageRequest, inlineHtml, pageJsonLd, renderPageSnapshot } from '../api/_lib/seoPages'
import { parseContent } from '../scripts/lib/seoMarkdown.mjs'
import { buildFaqJsonLd, guidePath, parseInline, type GuideContent } from '../src/seo/guides'
import type { PublicPage } from '../src/seo/publicPages'

/*
 * Test fixtures only: invented copy in the documented format, never shipped.
 * The real guides come from content/seo/.
 */
const GUIDE_MD = `---
slug: sample-guide
title: Sample Guide Title
description: A sample description for the parser test.
updated: 2026-11-22
---

# How to test a guide

The direct answer comes first. It is **two** sentences with a [link](/explore).

## Why it matters

A body paragraph.

- point one
- point two

### A sub heading

Sub section text.

## FAQs

### First question?

First answer.

### Second question?

Second answer, part one.

Part two.
`

const FAQ_MD = `---
title: Sample FAQ Title
description: A sample FAQ description.
---

# Sample FAQ

What this page covers.

## Booking

### How do I book?

Pick an event and register.

## Safety

**Q: Is it safe?** A: Events are in public venues.
`

function parseGuide(source = GUIDE_MD) {
  return parseContent(source, { fileName: 'sample.md', kind: 'guide' })
}

/** The same mapping publicPages.ts applies to a guide. */
function asPage(guide: GuideContent): PublicPage {
  return {
    slug: `guides/${guide.slug}`,
    path: guidePath(guide.slug),
    title: guide.title,
    description: guide.description,
    heading: guide.heading,
    sections: [{ paragraphs: guide.answer }, ...guide.sections],
    links: [{ href: '/explore', text: 'Explore events' }],
    faqs: guide.faqs,
    guide,
  }
}

describe('SEO content Markdown', () => {
  it('reads a guide: h1, direct answer, sections and FAQs', () => {
    const { content, errors } = parseGuide()
    expect(errors).toEqual([])
    expect(content.slug).toBe('sample-guide')
    expect(content.updated).toBe('2026-11-22')
    expect(content.heading).toBe('How to test a guide')
    expect(content.answer).toEqual(['The direct answer comes first. It is **two** sentences with a [link](/explore).'])
    expect(content.sections).toEqual([
      { heading: 'Why it matters', paragraphs: ['A body paragraph.'], items: ['point one', 'point two'] },
      { heading: 'A sub heading', paragraphs: ['Sub section text.'] },
    ])
    expect(content.faqs).toEqual([
      {
        items: [
          { question: 'First question?', answer: 'First answer.' },
          { question: 'Second question?', answer: 'Second answer, part one. Part two.' },
        ],
      },
    ])
  })

  it('reads the FAQ page with one group per category, including Q:/A: lines', () => {
    const { content, errors } = parseContent(FAQ_MD, { fileName: 'faq.md', kind: 'faq' })
    expect(errors).toEqual([])
    expect(content.answer).toEqual(['What this page covers.'])
    expect(content.faqs).toEqual([
      { heading: 'Booking', items: [{ question: 'How do I book?', answer: 'Pick an event and register.' }] },
      { heading: 'Safety', items: [{ question: 'Is it safe?', answer: 'Events are in public venues.' }] },
    ])
  })

  it('takes the slug from the file name when the front matter has none', () => {
    const source = GUIDE_MD.replace('slug: sample-guide\n', '')
    const { content } = parseContent(source, { fileName: 'article-1-how-to-make-friends.md', kind: 'guide' })
    expect(content.slug).toBe('how-to-make-friends')
  })

  it('rejects a title over 60 or a description over 155 characters', () => {
    const { errors } = parseGuide(
      GUIDE_MD.replace('Sample Guide Title', 'T'.repeat(61)).replace(
        'A sample description for the parser test.',
        'D'.repeat(156),
      ),
    )
    expect(errors.join('\n')).toMatch(/title is 61 characters/)
    expect(errors.join('\n')).toMatch(/description is 156 characters/)
  })

  it('rejects a guide with no direct answer or no FAQs', () => {
    const noAnswer = parseGuide(GUIDE_MD.replace(/The direct answer[^\n]*\n/, ''))
    expect(noAnswer.errors.join('\n')).toMatch(/no direct-answer paragraph/)
    const noFaqs = parseGuide(GUIDE_MD.slice(0, GUIDE_MD.indexOf('## FAQs')))
    expect(noFaqs.errors.join('\n')).toMatch(/no "## FAQ" section/)
  })

  it('rejects missing title and description', () => {
    const { errors } = parseGuide(GUIDE_MD.replace(/title:.*\n/, '').replace(/description:.*\n/, ''))
    expect(errors.join('\n')).toMatch(/"title:" is missing/)
    expect(errors.join('\n')).toMatch(/"description:" is missing/)
  })
})

describe('inline markup', () => {
  it('keeps bold and safe links, drops unsafe links to text', () => {
    expect(parseInline('a **b** [c](/explore)')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'c', href: '/explore' },
    ])
    for (const bad of ['[d](javascript:alert(1))', '[d](//evil.example)', '[d](http://plain.example)']) {
      expect(parseInline(bad).some((part) => part.kind === 'link')).toBe(false)
    }
    expect(parseInline('[d](https://crewday.nirmaansolutions.in/faq)')).toEqual([{ kind: 'link', text: 'd', href: '/faq' }])
  })

  it('escapes everything else in the server HTML', () => {
    expect(inlineHtml('<script>x</script> **<b>** [go](/faq)')).toBe(
      '&lt;script&gt;x&lt;/script&gt; <strong>&lt;b&gt;</strong> <a href="/faq">go</a>',
    )
  })
})

describe('pre-rendered guide', () => {
  const guide = parseGuide().content
  const page = asPage(guide)

  it('puts the direct answer right under the h1, before any other heading', () => {
    const html = renderPageSnapshot(page, [])
    expect(html.startsWith('<main><h1>How to test a guide</h1><p>The direct answer comes first.')).toBe(true)
    expect(html).toContain('<strong>two</strong>')
    expect(html).toContain('<a href="/explore">link</a>')
    expect(html).toContain('<h2>Frequently asked questions</h2><h3>First question?</h3><p>First answer.</p>')
  })

  it('publishes Article and FAQPage JSON-LD matching the visible questions', () => {
    const blocks = pageJsonLd(page, []) ?? []
    expect(blocks.map((block) => block['@type'])).toEqual(['Article', 'FAQPage'])
    const faq = blocks[1] as { mainEntity: { name: string; acceptedAnswer: { text: string } }[]; url: string }
    expect(faq.url).toBe('https://crewday.nirmaansolutions.in/guides/sample-guide')
    expect(faq.mainEntity).toEqual([
      { '@type': 'Question', name: 'First question?', acceptedAnswer: { '@type': 'Answer', text: 'First answer.' } },
      {
        '@type': 'Question',
        name: 'Second question?',
        acceptedAnswer: { '@type': 'Answer', text: 'Second answer, part one. Part two.' },
      },
    ])
  })

  it('names each category on the FAQ page and strips markup from the JSON-LD', () => {
    const faqPage = parseContent(FAQ_MD, { fileName: 'faq.md', kind: 'faq' }).content
    const html = renderPageSnapshot({ ...asPage(faqPage), slug: 'faq', path: '/faq', guide: undefined }, [])
    expect(html).toContain('<section id="faq"><h2>Booking</h2><h3>How do I book?</h3>')
    expect(html).not.toContain('Frequently asked questions')
    const jsonLd = buildFaqJsonLd([{ items: [{ question: '**Bold** q?', answer: 'See [events](/explore).' }] }], '/faq')
    expect(JSON.stringify(jsonLd)).toContain('"name":"Bold q?"')
    expect(JSON.stringify(jsonLd)).toContain('"text":"See events."')
  })

  it('has no FAQPage when there are no questions', () => {
    expect(buildFaqJsonLd([], '/faq')).toBeNull()
  })

  it('serves the plain app, uncached, for a guide that does not exist', async () => {
    const template = readFileSync('index.html', 'utf8')
    const response = await handlePageRequest(new Request('https://x/api/page?kind=page&slug=guides/nope'), {
      template: async () => template,
      fetchImpl: (() => Promise.reject(new Error('no network'))) as typeof fetch,
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})

describe('routing', () => {
  it('sends /faq and /guides/* through the pre-render function before the app fallback', () => {
    const rewrites = (JSON.parse(readFileSync('vercel.json', 'utf8')) as { rewrites: { source: string; destination: string }[] })
      .rewrites
    const index = (source: string) => rewrites.findIndex((rule) => rule.source === source)
    expect(rewrites[index('/faq')].destination).toBe('/api/page?kind=page&slug=faq')
    expect(rewrites[index('/guides/:guide')].destination).toBe('/api/page?kind=page&slug=guides/:guide')
    const fallback = rewrites.findIndex((rule) => rule.destination === '/index.html')
    expect(index('/faq')).toBeLessThan(fallback)
    expect(index('/guides/:guide')).toBeLessThan(fallback)
  })

  it('leaves the guides open to crawlers in robots.txt', () => {
    const robots = readFileSync('public/robots.txt', 'utf8')
    expect(robots).not.toMatch(/Disallow:\s*\/(guides|faq)/)
  })
})
