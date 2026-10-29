const buckets = new Map();

// simple fixed-window in-memory limiter (no PII persisted)
export function rateLimit({ max = 10, windowMs = 60_000 } = {}) {
  return async function (req, reply) {
    const key = `${req.ip}:${req.routeOptions?.url || req.url}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || now - b.start > windowMs) {
      b = { start: now, count: 0 };
      buckets.set(key, b);
    }
    b.count++;
    if (b.count > max) {
      reply.code(429).send({ error: 'Terlalu banyak permintaan. Coba lagi nanti.' });
      return;
    }
  };
}

// periodic cleanup so the map does not grow forever
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.start > 10 * 60_000) buckets.delete(k);
  }
}, 10 * 60_000).unref?.();