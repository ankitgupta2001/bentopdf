// netlify/edge-functions/rate-limit.js

export default async (request) => {
  const ip = request.headers.get('x-nf-client-connection-ip') || 'unknown';
  const url = new URL(request.url);

  // Skip static assets to avoid counting images/JS
  if (
    url.pathname.startsWith('/assets/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/favicon')
  ) {
    return null; // Let through
  }

  const kv = await Deno.openKv(); // Global Deno KV (free, persistent)
  const key = `rate:${ip}`;
  const now = Date.now();
  const hour = Math.floor(now / 3600000); // Current hour

  try {
    const result = await kv.get([key]);
    const data = result.value || { hour: 0, count: 0 };
    
    if (data.hour === hour) {
      if (data.count >= 50) {
        return new Response('Too many requests. Try again in an hour.', {
          status: 429,
          headers: {
            'Content-Type': 'text/plain',
            'Retry-After': '3600'
          }
        });
      }
      await kv.set([key], { hour, count: data.count + 1 }, { expireIn: 3600 });
    } else {
      await kv.set([key], { hour, count: 1 }, { expireIn: 3600 });
    }
  } catch (e) {
    console.error('KV error:', e);
    // Fail open — don’t block real users
  }

  return null; // Allow request
};

export const config = { path: '/*' };