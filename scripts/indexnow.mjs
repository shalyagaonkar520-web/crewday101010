#!/usr/bin/env node
/**
 * Tell IndexNow search engines (Bing and others, which feed ChatGPT search)
 * about new or changed pages.
 *
 *   npm run seo:indexnow                 # every URL in the live sitemap
 *   npm run seo:indexnow -- <url> ...    # just these URLs
 *
 * The key is public by design: IndexNow checks that https://<host>/<key>.txt
 * contains it. Run this after a deploy and after publishing events.
 */
const HOST = 'crewday.nirmaansolutions.in'
const KEY = 'e4e38888b25348c76f284a26b16f936f'

async function sitemapUrls() {
  const response = await fetch(`https://${HOST}/sitemap.xml`)
  if (!response.ok) throw new Error(`sitemap.xml answered ${response.status}`)
  const xml = await response.text()
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1])
}

const urls = process.argv.length > 2 ? process.argv.slice(2) : await sitemapUrls()
if (urls.length === 0) throw new Error('No URLs to submit')

const response = await fetch('https://api.indexnow.org/IndexNow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList: urls }),
})
console.log(`IndexNow: submitted ${urls.length} URLs, answer ${response.status}`)
if (response.status >= 400) process.exit(1)
