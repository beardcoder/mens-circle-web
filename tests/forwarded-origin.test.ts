/**
 * Regression guard for the 403 that broke every Anmeldung in production:
 * "Cross-site POST form submissions are forbidden".
 *
 * TLS terminates at the Coolify/Traefik proxy, so the Bun process sees plain
 * HTTP and builds `http://<host>` as the request URL, while the browser's
 * `Origin` on the form POST says `https://<host>`. Astro's CSRF check compares
 * the two and rejects the mismatch. `security.allowedDomains` in
 * astro.config.mjs is what makes Astro trust `X-Forwarded-Proto` and repair the
 * URL first — so this exercises Astro's own validator and origin check against
 * the real config, not a copy of it.
 */
import { expect, test } from 'bun:test';
// Deep imports: these two modules are the code that decides, and Astro exports
// neither. If an upgrade moves them the import fails loudly — re-verify the fix
// then rather than deleting this test.
import { isForbiddenCrossOriginRequest } from '../node_modules/astro/dist/core/app/origin-check.js';
import { validateForwardedHeaders } from '../node_modules/astro/dist/core/app/validate-headers.js';
import config from '../astro.config.mjs';

const allowedDomains = config.security?.allowedDomains ?? [];

/** The proxy's own headers, as Traefik sends them in front of this app. */
const PROXIED = { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'mens-circle.de' };

/**
 * What Astro does per request: build the URL from the (plain HTTP) request,
 * then let the forwarded headers correct it if `allowedDomains` permits.
 * Mirrors RenderContext#applyForwardedHeaders.
 */
function rejects(headers: Record<string, string>, domains: typeof allowedDomains = allowedDomains): boolean {
  const request = new Request('http://mens-circle.de/_actions/register', {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=x', ...headers },
    body: 'x',
  });
  const url = new URL(request.url);
  const forwarded = validateForwardedHeaders(
    headers['x-forwarded-proto'],
    headers['x-forwarded-host'],
    undefined,
    domains,
  );
  if (forwarded.protocol) url.protocol = `${forwarded.protocol}:`;
  if (forwarded.host) url.hostname = forwarded.host;
  return isForbiddenCrossOriginRequest(request, url, false);
}

test('the config names the canonical domain, and keeps the CSRF check on', () => {
  expect(allowedDomains).toEqual([{ hostname: 'mens-circle.de', protocol: 'https' }]);
  // `checkOrigin` defaults to true; an explicit `false` would be the wrong fix.
  expect(config.security?.checkOrigin).toBeUndefined();
});

test('a form POST behind the TLS-terminating proxy is accepted', () => {
  expect(rejects({ origin: 'https://mens-circle.de', ...PROXIED })).toBe(false);
  // Without allowedDomains the forwarded protocol is ignored — the shipped bug.
  expect(rejects({ origin: 'https://mens-circle.de', ...PROXIED }, [])).toBe(true);
});

test('a genuine cross-site POST is still forbidden', () => {
  expect(rejects({ origin: 'https://evil.example', ...PROXIED })).toBe(true);
  expect(rejects({ ...PROXIED })).toBe(true);
});

test('a spoofed x-forwarded-host is ignored, not trusted', () => {
  const spoofed = { origin: 'https://evil.example', 'x-forwarded-proto': 'https', 'x-forwarded-host': 'evil.example' };
  expect(rejects(spoofed)).toBe(true);
});
