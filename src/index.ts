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

    return response
  },
}
