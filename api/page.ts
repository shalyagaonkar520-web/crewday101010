import { handlePageRequest } from './_lib/seoPages.js'
import { productionSeoDeps } from './_lib/seoRuntime.js'

/**
 * GET /api/page: public pages and event pages with their SEO tags, structured
 * data and a plain-HTML summary in the first response. Reached through the
 * rewrites in vercel.json; the browser still gets the same single-page app.
 */
export async function GET(request: Request): Promise<Response> {
  return handlePageRequest(request, productionSeoDeps(request))
}
