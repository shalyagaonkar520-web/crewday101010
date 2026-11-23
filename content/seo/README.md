# SEO content: guides and FAQ

The copy for `/guides/<slug>` and `/faq` lives here as Markdown. `npm run seo:content` turns it into `src/seo/content.generated.ts`, which both the app and the pre-render function (`api/page.ts`) read. A page exists on the site only if its file is here: with no files, nothing new is published.

```
content/seo/guides/<any-name>.md   one guide each, served at /guides/<slug>
content/seo/faq.md                 the FAQ page, served at /faq
```

After adding or changing a file:

```
npm run seo:content     # rebuild src/seo/content.generated.ts
npm run verify          # also fails if you forgot the step above
```

## Guide format

```markdown
---
slug: how-to-make-friends-in-bengaluru
title: How to Make Friends in Bengaluru (2026 Guide)
description: New to Bengaluru? Practical ways to meet people offline, from weekend walks to board game nights, and how to keep the friendships going.
updated: 2026-11-22
---

# How to make friends in Bengaluru

The direct answer: 2 or 3 sentences that answer the question on their own. This is the
first thing under the heading, in the HTML that crawlers and AI engines read.

## A section heading

Paragraphs, **bold** and [links](/explore) are kept. Lists work too:

- one point
- another point

## FAQs

### Is it hard to make friends in Bengaluru?

The answer, in one or more paragraphs.

### Next question?

Its answer.
```

Rules (the script stops with the file name if one is broken):

- `title` (the title tag) is at most 60 characters and `description` (the meta description) at most 155, as in `STEP2_SITE_CONTENT_PLAN.md`.
- `slug` is lower-case words joined by hyphens. If left out, it comes from the file name (`article-1-how-to-make-friends.md` becomes `how-to-make-friends`).
- There is exactly one `# ` heading, and at least one paragraph between it and the first `## `: that is the direct answer.
- The FAQ section is the `## ` heading containing "FAQ" or "Frequently asked". Each `### ` under it is a question; the paragraphs below it are the answer. `**Q: ...**` / `A: ...` lines also work.
- `updated` is optional (YYYY-MM-DD). Tables and images are skipped.

## FAQ page format

Same front matter (no `slug`) and `# ` heading with a short intro paragraph. Every `## ` heading is a category, and every `### ` under it a question:

```markdown
---
title: CrewDay FAQ: Events, Tickets, Payments and Safety
description: Answers to common questions about CrewDay: how events work, booking and paying, refunds, safety at meet-ups and hosting your own event.
---

# CrewDay FAQ

One or two sentences saying what CrewDay is, for anyone landing here first.

## Booking

### How do I book a seat?

Answer.
```

## What the site does with it

- **Plain HTML first:** the server sends the h1, the direct answer, every section and every question and answer as HTML, before any JavaScript.
- **Structured data:** each guide gets `Article` and `FAQPage` JSON-LD; `/faq` gets `FAQPage`. The JSON-LD is built from the same text that is shown, as Google requires.
- **Sitemap:** every guide and `/faq` are added to `/sitemap.xml` automatically.
