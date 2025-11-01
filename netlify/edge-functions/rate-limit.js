// netlify/edge-functions/rate-limit.js

// In-memory store (resets on deploy or cold start – safe for low traffic)
const rateMap = new Map();

export default async (request) => {
  const ip = request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const url = new URL(request.url);

  // Skip static assets (don't count images, JS, CSS)
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    return null;
  }

  const now = Date.now();
  const currentHour = Math.floor(now / 3600000); // Hour as key
  const key = `${ip}:${currentHour}`;

  try {
    const entry = rateMap.get(key) || { count: 0, resetAt: currentHour + 1 };
    
    if (entry.count >= 50) {
      return new Response('Too many requests. Try again in an hour.', {
        status: 429,
        headers: {
          'Content-Type': 'text/plain',
          'Retry-After': '3600'
        }
      });
    }

    // Increment count
    rateMap.set(key, {
      count: entry.count + 1,
      resetAt: currentHour + 1
    });

    // Optional: Clean old entries every 100 requests
    if (rateMap.size > 1000) {
      for (const [k, v] of rateMap.entries()) {
        if (v.resetAt <= currentHour) {
          rateMap.delete(k);
        }
      }
    }

  } catch (e) {
    console.error('Rate limit error:', e);
    // Fail open — never break site
  }

  return null; // Allow request
};

export const config = { path: '/*' };