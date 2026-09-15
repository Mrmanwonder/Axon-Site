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

// Keep this in lock-step with netlify.toml. Security headers are part of the
// application boundary, not a hosting-provider preference: moving the same Vite
// build from Netlify to Cloudflare must not silently remove the CSP.
//
// `unsafe-inline` is currently required for the tiny pre-paint theme script in
// index.html and for the existing inline style path. Removing those exceptions
// is tracked as a separate hardening item; parity is the immediate security fix.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self' https://*.supabase.co",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.r2.cloudflarestorage.com",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://mastery-api.tanmay-harkawat.workers.dev https://*.r2.cloudflarestorage.com",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
].join('; ')

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
    headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY)
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers })
  },
}
