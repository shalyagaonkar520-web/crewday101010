# SEO and crawlability

How CrewDay is made readable to Google and to AI crawlers, and what to run after changes.

## How a page is served

The site is a single-page app, so the first HTML a crawler gets used to be an empty shell. Now:

| URL | Served by | What the first response contains |
|---|---|---|
| `/` | static `index.html` | Title, description, canonical, Open Graph, Organization and WebSite JSON-LD, and a short summary with links |
| `/explore`, `/about`, `/plan`, `/terms`, `/privacy`, `/refund-policy`, `/shipping-policy`, `/contact`, `/delete-account` | `api/page.ts` | That page's own title, description and canonical, a plain-HTML summary (one h1), and for `/explore` the upcoming open events as links plus an `ItemList` |
| `/events/:eventId` | `api/page.ts` | The event's title, description, canonical and share image, an `Event` and a `BreadcrumbList` (JSON-LD), and the event as plain HTML: title, date and time in words, venue, price, description, a register link |
| `/sitemap.xml` | `api/sitemap.ts` | Static pages plus every published event with `lastmod` |
| anything else | static `index.html` | The app shell (see "Not done") |

The browser still gets the same app: React replaces the placeholder inside `#root` when it starts.

Events are read from Firestore's public REST API with no credentials. The rules let anyone read an event that is not a draft, so a draft answers 403 and is treated as not found. Nothing private can be read this way.

Pages are cached at the Vercel CDN for 5 minutes (then served stale while refreshed), the sitemap for an hour. **A new event is crawlable within about 5 minutes, with no redeploy.**

If Firestore is unreachable the function serves the plain app and tells the CDN not to cache it, and the sitemap falls back to the static pages. A failure here never takes the site down.

## Where the copy lives

- `src/seo/publicPages.ts`: title, description and summary of every public page. Used by the browser (`routeMeta.tsx`) and the server, so they never differ.
- `src/seo/eventMeta.ts`, `src/seo/eventSeo.ts`: event title and description, `Event` and `BreadcrumbList` JSON-LD. Only fields that exist in Firestore are used; `addressRegion` is set to Karnataka only for Bengaluru.
- `api/_lib/seoPages.ts`: the renderer and sitemap.

## Fast indexing: IndexNow

`public/<key>.txt` proves site ownership to IndexNow (Bing and others, which feed ChatGPT search). The key is public by design.

```
npm run seo:indexnow                  # submit every URL in the live sitemap
npm run seo:indexnow -- <url> <url>   # just these
```

Run it after a deploy and after publishing events. It is manual because the site has no scheduler on the free plan.

## After changing anything here

1. `npm run verify`
2. After deploying, check: `curl -s https://crewday.nirmaansolutions.in/events/<id> | grep -i "<h1"` and `curl -s .../sitemap.xml`.
3. Run an event page through Google's Rich Results Test.

## Not done

- **Real 404s.** Unknown paths still answer 200 with the app shell, because the SPA fallback serves them statically (the app's not-found page is `noindex`). Sending every path through a function to return 404 would put the whole app behind one function, which isn't worth the risk.
- **Readable event URLs** (`/events/:id/:slug`).
- **Generated share images** for events without a photo (`@vercel/og`): they fall back to the CrewDay card.
- **Full policy text** in the first response: the legal pages get a summary; the complete privacy policy is also at `/privacy.html`.
