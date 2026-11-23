/**
 * Turns the SEO content Markdown (content/seo/) into the data the site renders.
 * The format is described in content/seo/README.md. Pure functions, no I/O, so
 * tests/seoContent.unit.test.ts can run them directly.
 */

export const TITLE_MAX = 60
export const DESCRIPTION_MAX = 155
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FAQ_HEADING = /\bfaqs?\b|frequently asked/i

/** Front matter: `key: value` lines between two `---` lines at the very top. */
export function splitFrontMatter(source) {
  const text = source.replace(/\r\n/g, '\n').replace(/^﻿/, '')
  const match = /^---\n([\s\S]*?)\n---\n?/.exec(text)
  if (!match) return { meta: {}, body: text }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const pair = /^([A-Za-z][\w-]*)\s*:\s*(.*)$/.exec(line.trim())
    if (pair) meta[pair[1].toLowerCase()] = pair[2].trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return { meta, body: text.slice(match[0].length) }
}

/** Keeps **bold** and [links](url); drops other emphasis and code ticks. */
export function cleanInline(text) {
  return text
    .replace(/__([^_]+)__/g, '**$1**')
    .replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g, '$1$2')
    .replace(/(^|\W)_([^_\s][^_]*?)_(?=\W|$)/g, '$1$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

const stripQ = (text) => text.replace(/^\*\*(.*)\*\*$/, '$1').replace(/^(?:Q|Question)\s*[:.)-]\s*/i, '').trim()
const stripA = (text) => text.replace(/^\*\*(?:A|Answer)\s*[:.)-]\s*\*\*\s*/i, '').replace(/^(?:A|Answer)\s*[:.)-]\s*/i, '').trim()

/**
 * Splits a Markdown body into blocks: headings, paragraphs and lists.
 * Images, HTML comments, rules and tables are skipped, with a warning for tables.
 */
export function blocks(body, warn = () => {}) {
  const out = []
  let paragraph = []
  let list = null
  const flushParagraph = () => {
    if (paragraph.length) out.push({ type: 'p', text: cleanInline(paragraph.join(' ')) })
    paragraph = []
  }
  const flushList = () => {
    if (list?.length) out.push({ type: 'list', items: list.map(cleanInline) })
    list = null
  }
  const lines = body.replace(/<!--[\s\S]*?-->/g, '').split('\n')
  for (const raw of lines) {
    const line = raw.trim()
    const heading = /^(#{1,6})\s+(.*?)\s*#*$/.exec(line)
    const item = /^(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (!line) {
      flushParagraph()
      flushList()
    } else if (heading) {
      flushParagraph()
      flushList()
      out.push({ type: 'h', level: heading[1].length, text: cleanInline(heading[2]) })
    } else if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(line) || /^!\[[^\]]*\]\([^)]*\)$/.test(line)) {
      flushParagraph()
      flushList()
    } else if (line.startsWith('|')) {
      flushParagraph()
      flushList()
      warn('tables are not supported and were skipped')
    } else if (item) {
      flushParagraph()
      list ??= []
      list.push(item[1])
    } else if (list && /^\s{2,}/.test(raw)) {
      list[list.length - 1] += ` ${line}`
    } else {
      flushList()
      paragraph.push(line.replace(/^>\s?/, ''))
    }
  }
  flushParagraph()
  flushList()
  return out
}

/**
 * Reads the FAQ blocks of one group. A question is an h3 (### ...) or a bold
 * "Q:" line; its answer is every paragraph up to the next question.
 */
function readFaqs(items, warn) {
  const faqs = []
  let current = null
  const push = () => {
    if (!current) return
    if (current.answer.length) faqs.push({ question: current.question, answer: current.answer.join(' ') })
    else warn(`question without an answer: "${current.question}"`)
    current = null
  }
  for (const block of items) {
    const qLine = block.type === 'p' && /^\*\*(?:Q|Question)\s*[:.)-]|^(?:Q|Question)\s*[:.)-]/i.test(block.text)
    if ((block.type === 'h' && block.level >= 3) || qLine) {
      push()
      // "**Q: question?** A: answer" on one line.
      const [q, a] = block.text.split(/\s(?:\*\*)?(?:A|Answer)\s*[:.)-]\s*(?:\*\*)?\s*/i)
      current = { question: stripQ(q), answer: a ? [a.trim()] : [] }
    } else if (current && block.type === 'p') {
      current.answer.push(stripA(block.text))
    } else if (current && block.type === 'list') {
      current.answer.push(block.items.join('; '))
    }
  }
  push()
  return faqs
}

function slugFromFile(fileName) {
  return fileName
    .replace(/\.md$/i, '')
    .replace(/^article-\d+-/i, '')
    .toLowerCase()
}

/**
 * One guide or the FAQ page. `kind` is 'guide' (FAQs live under one "FAQ"
 * heading) or 'faq' (every h2 is a question category).
 */
export function parseContent(source, { fileName, kind }) {
  const errors = []
  const warnings = []
  const warn = (message) => warnings.push(`${fileName}: ${message}`)
  const fail = (message) => errors.push(`${fileName}: ${message}`)
  const { meta, body } = splitFrontMatter(source)
  const list = blocks(body, warn)

  const h1Index = list.findIndex((block) => block.type === 'h' && block.level === 1)
  const heading = h1Index >= 0 ? list[h1Index].text : ''
  if (!heading) fail('no "# " heading (the h1) found')
  const rest = h1Index >= 0 ? list.slice(h1Index + 1) : list

  const firstH2 = rest.findIndex((block) => block.type === 'h' && block.level === 2)
  const intro = firstH2 >= 0 ? rest.slice(0, firstH2) : rest
  const answer = intro.filter((block) => block.type === 'p').map((block) => block.text)
  if (!answer.length) fail('no direct-answer paragraph between the "# " heading and the first "## " heading')

  const sections = []
  const faqs = []
  let group = null
  const closeGroup = () => {
    if (!group) return
    if (group.mode === 'faq') {
      const items = readFaqs(group.blocks, warn)
      if (items.length) faqs.push(kind === 'faq' ? { heading: group.heading, items } : { items })
    } else {
      // A "### " inside a body section starts a new section of its own.
      let target = { heading: group.heading }
      for (const block of group.blocks) {
        if (block.type === 'h') {
          sections.push(target)
          target = { heading: block.text }
        } else if (block.type === 'p') {
          ;(target.paragraphs ??= []).push(block.text)
        } else {
          ;(target.items ??= []).push(...block.items)
        }
      }
      sections.push(target)
    }
    group = null
  }
  for (const block of firstH2 >= 0 ? rest.slice(firstH2) : []) {
    if (block.type === 'h' && block.level === 2) {
      closeGroup()
      const mode = kind === 'faq' || FAQ_HEADING.test(block.text) ? 'faq' : 'body'
      group = { heading: block.text, mode, blocks: [] }
    } else if (group) {
      group.blocks.push(block)
    }
  }
  closeGroup()

  const slug = (meta.slug || slugFromFile(fileName)).replace(/^\/?(?:guides\/)?/, '').replace(/\/$/, '')
  const title = meta.title ? cleanInline(meta.title) : ''
  const description = meta.description ? cleanInline(meta.description) : ''
  if (kind === 'guide' && !SLUG.test(slug)) fail(`slug "${slug}" must be lower-case words joined by hyphens`)
  if (!title) fail('front matter "title:" is missing (the title tag from STEP2_SITE_CONTENT_PLAN.md)')
  else if (title.length > TITLE_MAX) fail(`title is ${title.length} characters; the limit is ${TITLE_MAX}`)
  if (!description) fail('front matter "description:" is missing (the meta description from STEP2_SITE_CONTENT_PLAN.md)')
  else if (description.length > DESCRIPTION_MAX)
    fail(`description is ${description.length} characters; the limit is ${DESCRIPTION_MAX}`)
  if (!faqs.length) fail(kind === 'faq' ? 'no questions found under "## " categories' : 'no "## FAQ" section with "### " questions found')
  if (meta.updated && !/^\d{4}-\d{2}-\d{2}$/.test(meta.updated)) fail('"updated:" must be YYYY-MM-DD')

  const content = {
    slug,
    title,
    description,
    heading,
    answer,
    sections: sections.filter((section) => section.heading || section.paragraphs || section.items),
    faqs,
    ...(meta.updated ? { updated: meta.updated } : {}),
  }
  return { content, errors, warnings }
}
