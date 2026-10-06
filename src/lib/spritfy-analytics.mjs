import { createPublicKey, verify } from 'node:crypto';

// This is a PUBLIC verification key, not a credential. Its private counterpart
// exists only in SPRITFY's server environment and cannot administer Umami.
const PUBLIC_KEY = 'MCowBQYDK2VwAyEANug5MIzCtgfTpaDHv9eVctWqtk5wSOXrVjVhArzOexY=';
export const SPRITFY_WEBSITE_ID = 'fe0f5604-5b1d-49da-8aaa-1a455fc96838';
const COLUMNS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const DAY = 86400000;
const reply = (status, body) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'private, no-store', Vary: 'X-Spritfy-Signature' },
});

export function createSpritfyUtmHandler({ query, publicKey = PUBLIC_KEY, now = Date.now }) {
  const key = createPublicKey({ key: Buffer.from(publicKey, 'base64'), type: 'spki', format: 'der' });
  return async request => {
    if (request.method !== 'GET') return reply(405, { error: 'method' });
    const params = new URL(request.url).searchParams;
    const from = params.get('from'), to = params.get('to');
    const timestamp = request.headers.get('x-spritfy-timestamp') || '';
    const signature = request.headers.get('x-spritfy-signature') || '';
    if (!/^\d{13}$/.test(timestamp) || now() - Number(timestamp) > 300000 || Number(timestamp) - now() > 60000 || !/^[A-Za-z0-9_-]{86}$/.test(signature)) {
      return reply(401, { error: 'unauthorized' });
    }
    const message = `spritfy-utm-v1\n${timestamp}\n${from}\n${to}`;
    if (!verify(null, Buffer.from(message), key, Buffer.from(signature, 'base64url'))) return reply(401, { error: 'unauthorized' });
    if ([...params.keys()].some(name => !['from', 'to'].includes(name)) || params.getAll('from').length !== 1 || params.getAll('to').length !== 1) return reply(400, { error: 'date_invalid' });
    const parse = value => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
      const ms = Date.parse(`${value}T00:00:00+09:00`);
      return Number.isFinite(ms) && new Date(ms + 9 * 3600000).toISOString().slice(0, 10) === value ? ms : NaN;
    };
    const start = parse(from), end = parse(to) + DAY - 1;
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end - start >= 93 * DAY || end > now() + DAY) return reply(400, { error: 'date_invalid' });
    try {
      const entries = await Promise.all(COLUMNS.map(async column => {
        const rows = await query(SPRITFY_WEBSITE_ID, { column, startDate: new Date(start), endDate: new Date(end) }, {});
        if (!Array.isArray(rows)) throw new Error('invalid_result');
        return [column, rows.map(row => {
          const views = Number(row.views);
          if (typeof row.utm !== 'string' || !Number.isSafeInteger(views) || views < 0) throw new Error('invalid_result');
          return { utm: row.utm.slice(0, 200), views };
        })];
      }));
      return reply(200, { from, to, limit: 50, dimensions: Object.fromEntries(entries) });
    } catch {
      return reply(502, { error: 'analytics_unavailable' });
    }
  };
}
