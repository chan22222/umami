import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { createSpritfyUtmHandler, SPRITFY_WEBSITE_ID } from '../src/lib/spritfy-analytics.mjs';
const pair = generateKeyPairSync('ed25519');
const now = Date.parse('2026-10-06T12:00:00Z');
let calls = [], broken = false;
const handler = createSpritfyUtmHandler({
  publicKey: pair.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'), now: () => now,
  query: async (...args) => { calls.push(args); if (broken) throw new Error('database password'); return [{ utm: 'google', views: 3n }]; },
});
const request = (from = '2026-10-01', to = '2026-10-06', timestamp = now, suffix = '') => {
  const signature = sign(null, Buffer.from(`spritfy-utm-v1\n${timestamp}\n${from}\n${to}`), pair.privateKey).toString('base64url');
  return new Request(`https://example.com/api/integrations/spritfy/utm?from=${from}&to=${to}${suffix}`, { headers: { 'X-Spritfy-Timestamp': String(timestamp), 'X-Spritfy-Signature': signature } });
};
assert.equal((await handler(new Request('https://example.com/'))).status, 401);
assert.equal(calls.length, 0);
assert.equal((await handler(request(undefined, undefined, now - 300001))).status, 401);
assert.equal((await handler(request(undefined, undefined, now + 60001))).status, 401);
const changed = request();
assert.equal((await handler(new Request(changed.url.replace('10-01', '10-02'), changed))).status, 401);
assert.equal((await handler(request('2026-02-30', '2026-03-01'))).status, 400);
assert.equal((await handler(request('2026-01-01', '2026-10-01'))).status, 400);
assert.equal((await handler(request(undefined, undefined, now, '&websiteId=other'))).status, 400);
assert.equal(calls.length, 0);
const valid = await handler(request());
assert.equal(valid.status, 200);
assert.equal(valid.headers.get('Cache-Control'), 'private, no-store');
assert.equal((await valid.json()).dimensions.utm_source[0].views, 3);
assert.equal(calls.length, 5);
assert(calls.every(([website, parameters]) => website === SPRITFY_WEBSITE_ID && parameters.startDate.toISOString() === '2026-09-30T15:00:00.000Z'));
broken = true;
const failure = await handler(request());
assert.equal(failure.status, 502);
assert.equal((await failure.text()).includes('password'), false);
console.log('PASS: signed SPRITFY-only aggregate query, tampering/expiry/date limits, no anonymous query, sanitized errors');
