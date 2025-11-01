import { Blob } from 'node:blob';  // For Blobs API

export default async (request, context) => {
  const ip = request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const url = new URL(request.url);

  // Skip non-main paths (e.g., /assets)
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/_next/')) {
    return null;  // Let static files through
  }

  const key = `rate:${ip}`;
  const now = Date.now();
  const hour = Math.floor(now / 3600000).toString();  // Current hour as string

  try {
    // Get Blob store from context
    const store = context.blobs.get('rate-limits');  // Named store
    const blob = await store.get(key) || new Blob(['0'], { type: 'text/plain' });
    const countText = await blob.text();
    let count = parseInt(countText, 10) || 0;

    if (count >= 50) {  // 50 requests/hour per IP
      return new Response('Too many requests. Try again in an hour.', {
        status: 429,
        headers: { 'Content-Type': 'text/plain', 'Retry-After': '3600' }
      });
    }

    // Increment & store for 1 hour
    count++;
    const newBlob = new Blob([count.toString()], { type: 'text/plain' });
    await store.put(key, newBlob, { expirationTtl: 3600 });  // Auto-expire

  } catch (e) {
    console.log('Rate limit error:', e);  // Log but fail open
  }

  return null;  // Allow request
};

export const config = { path: '/*' };  // Apply to all paths