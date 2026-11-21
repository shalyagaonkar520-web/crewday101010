import { handleSitemapRequest } from './_lib/seoPages.js'
import { productionSeoDeps } from './_lib/seoRuntime.js'

/** GET /sitemap.xml (rewritten here): static pages plus every published event. */
export async function GET(request: Request): Promise<Response> {
  return handleSitemapRequest(productionSeoDeps(request))
}
