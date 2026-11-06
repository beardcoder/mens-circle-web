import { expect, test } from 'bun:test';

import { clientIp, parseTrustedProxy, rateLimit } from '../src/lib/server/ratelimit';

const request = (headers: Record<string, string>) => new Request('http://localhost/_actions/register', { headers });

test('a forged X-Forwarded-For never changes the bucket', () => {
  for (const trust of ['none', 'cloudflare'] as const) {
    const honest = clientIp(request({ 'cf-connecting-ip': '203.0.113.7' }), '10.0.0.2', trust);

    for (const xff of ['198.51.100.1', '198.51.100.2, 203.0.113.7', 'unknown']) {
      expect(clientIp(request({ 'x-forwarded-for': xff, 'cf-connecting-ip': '203.0.113.7' }), '10.0.0.2', trust)).toBe(
        honest,
      );
    }
  }
});

test('the limit holds while the client rotates X-Forwarded-For', () => {
  const key = `test-${crypto.randomUUID()}`;

  const allowed = Array.from({ length: 5 }, (_, i) =>
    rateLimit(key, clientIp(request({ 'x-forwarded-for': `198.51.100.${i}` }), '192.0.2.10', 'none'), 3, 3600),
  );

  expect(allowed).toEqual([true, true, true, false, false]);
});

test('cloudflare mode keys by CF-Connecting-IP, otherwise by the peer address', () => {
  const req = request({ 'cf-connecting-ip': ' 203.0.113.7 ' });

  expect(clientIp(req, '10.0.0.2', 'cloudflare')).toBe('203.0.113.7');
  expect(clientIp(req, '10.0.0.2', 'none')).toBe('10.0.0.2');
  expect(clientIp(request({}), '10.0.0.2', 'cloudflare')).toBe('10.0.0.2');
  expect(clientIp(request({}), undefined, 'none')).toBe('unknown');
});

test('only the literal "cloudflare" trusts a header', () => {
  expect(parseTrustedProxy('cloudflare')).toBe('cloudflare');

  for (const value of ['', 'none', 'Cloudflare', 'true', 'x-forwarded-for'])
    expect(parseTrustedProxy(value)).toBe('none');
});
