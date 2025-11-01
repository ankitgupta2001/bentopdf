export default async (request, context) => {
  const ip = request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const url = new URL(request.url);

  // Skip non-main paths (e.g., /assets) to avoid limiting static files
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/_next/')) {
    return null;
  }

  const key = `rate:${ip}`;
  const now = Date.now();
  const hour = Math.floor(now / 3600000).toString();  // Current hour key

  try {
    // Get Blobs store from context (Netlify 2025 API)
    const store = context.blobs.getStore('rate-limits');  // Named store for persistence
    const countText = await store.get(key) || '0';
    let count = parseInt(countText, 10) || 0;

    if (count >= 50) {  // 50 requests/hour per IP – adjust if needed
      return new Response('Too many requests. Try again in an hour.', {
        status: 429,
        headers: { 'Content-Type': 'text/plain', 'Retry-After': '3600' }
      });
    }

    // Increment & store as string for 1 hour TTL
    count++;
    await store.set(key, count.toString(), { expirationTtl: 3600 });  // Auto-expire

  } catch (e) {
    console.log('Rate limit error:', e);  // Log but fail open (allow access)
  }

  return null;  // Allow the request
};

export const config = { path: '/*' };  // Apply to all paths