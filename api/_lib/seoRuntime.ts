import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { SeoDeps } from './seoPages.js'

/**
 * The built index.html: read from the bundle (vercel.json includes dist/index.html
 * in every function), or fetched from the site's own static file if it is not there.
 * `/index.html` is a real file, so that request never comes back to a function.
 */
export function productionSeoDeps(request: Request): SeoDeps {
  return {
    fetchImpl: fetch,
    template: async () => {
      try {
        return await readFile(join(process.cwd(), 'dist', 'index.html'), 'utf8')
      } catch {
        const response = await fetch(new URL('/index.html', request.url))
        if (!response.ok) throw new Error(`index.html answered ${response.status}`)
        return response.text()
      }
    },
  }
}
