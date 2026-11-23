import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import NotFoundPage from '@/pages/NotFound'
import { parseInline } from '@/seo/guides'
import { PUBLIC_PAGES } from '@/seo/publicPages'
import { formatEventDate } from '@/utils/format'

/** Text with its **bold** and [links](/path), the same markup the server renders. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((part, index) =>
        part.kind === 'bold' ? (
          <strong key={index}>{part.text}</strong>
        ) : part.kind === 'link' ? (
          part.href.startsWith('/') ? (
            <Link key={index} to={part.href} className="font-semibold text-brand-600 hover:underline">
              {part.text}
            </Link>
          ) : (
            <a key={index} href={part.href} className="font-semibold text-brand-600 hover:underline" rel="noopener">
              {part.text}
            </a>
          )
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

/**
 * An editorial guide (/guides/:slug) or the FAQ page (/faq). The copy and the
 * order match the pre-rendered HTML from api/page.ts, so what a crawler reads
 * before JavaScript runs is what a visitor sees after.
 */
export default function GuidePage() {
  const { pathname } = useLocation()
  const page = PUBLIC_PAGES.find((entry) => entry.path === pathname.replace(/\/$/, ''))
  if (!page || !page.faqs) return <NotFoundPage />

  const [answer, ...sections] = page.sections
  const namedGroups = page.faqs.some((group) => group.heading)

  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink-100 bg-surface">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link to="/">
            <Logo />
          </Link>
          <Link
            to="/explore"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-500 hover:text-ink-900"
          >
            <ArrowLeft size={16} aria-hidden /> Explore events
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 text-ink-700 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_h3]:mt-5 [&_h3]:font-bold [&_h3]:text-ink-900 [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-3 [&_p]:leading-relaxed [&_ul]:mt-3 [&_ul]:space-y-1.5">
        <h1 className="font-display text-3xl font-extrabold text-ink-900">{page.heading}</h1>
        {page.guide?.updated ? (
          <p className="text-sm text-ink-500">Updated {formatEventDate(page.guide.updated)}</p>
        ) : null}

        {/* The direct answer: the first thing on the page, as in the pre-rendered HTML. */}
        {answer?.paragraphs?.map((text, index) => (
          <p key={index} className="text-lg">
            <Inline text={text} />
          </p>
        ))}

        {sections.map((section, index) => (
          <section key={index}>
            {section.heading ? <h2>{section.heading}</h2> : null}
            {section.paragraphs?.map((text, i) => (
              <p key={i}>
                <Inline text={text} />
              </p>
            ))}
            {section.items?.length ? (
              <ul>
                {section.items.map((item, i) => (
                  <li key={i}>
                    <Inline text={item} />
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}

        <section id="faq">
          {namedGroups ? null : <h2>Frequently asked questions</h2>}
          {page.faqs.map((group, index) => (
            <div key={index}>
              {namedGroups && group.heading ? <h2>{group.heading}</h2> : null}
              {group.items.map((item, i) => (
                <div key={i}>
                  <h3>
                    <Inline text={item.question} />
                  </h3>
                  <p>
                    <Inline text={item.answer} />
                  </p>
                </div>
              ))}
            </div>
          ))}
        </section>

        {page.links.length ? (
          <nav aria-label="Related pages" className="mt-10 flex flex-wrap gap-2">
            {page.links.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-600 shadow-soft hover:shadow-lift"
              >
                {item.text}
              </Link>
            ))}
          </nav>
        ) : null}
      </main>
    </div>
  )
}
