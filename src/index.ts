/**
 * Cloudflare Worker entry point for Axon.
 * Serves the static Vite build output using the ASSETS binding.
 * With Wrangler 3+, the ASSETS binding automatically handles static file serving.
 */

interface Env {
  ASSETS: {
    fetch: (request: Request | string) => Promise<Response>
  }
  AXON_SITE_URL: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.protocol !== 'https:' && url.hostname !== 'localhost') {
      url.protocol = 'https:'
      return Response.redirect(url, 301)
    }

    // Try to serve the requested asset
    let response = await env.ASSETS.fetch(request)

    // If the asset doesn't exist and it's a navigation request,
    // serve index.html for React Router client-side routing
    if (response.status === 404 && request.method === 'GET') {
      const pathname = url.pathname
      // Don't redirect for API routes or hidden files
      if (!pathname.startsWith('/api/') && !pathname.startsWith('/.')) {
        response = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url).toString(), request))
      }
    }

    const headers = new Headers(response.headers)
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    headers.set('X-Content-Type-Options', 'nosniff')
    headers.set('X-Frame-Options', 'SAMEORIGIN')
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    headers.set('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()')
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
}
