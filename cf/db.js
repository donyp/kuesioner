// Thin async helpers around Cloudflare D1.
// Every query returns plain JSON-friendly objects.

export async function all(c, sql, ...params) {
  const res = await c.env.DB.prepare(sql).bind(...params).all();
  return res.results || [];
}

export async function first(c, sql, ...params) {
  return await c.env.DB.prepare(sql).bind(...params).first();
}

export async function run(c, sql, ...params) {
  return await c.env.DB.prepare(sql).bind(...params).run();
}

export function stmt(c, sql, ...params) {
  return c.env.DB.prepare(sql).bind(...params);
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
