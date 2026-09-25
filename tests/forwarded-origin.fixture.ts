/** Executed only by forwarded-origin.test.ts, in a child process started with `--no-env-file` and an explicit environment. */
import assert from 'node:assert/strict';
// Deep imports: these two modules are the code that decides, and Astro exports neither.
import { isForbiddenCrossOriginRequest } from '../node_modules/astro/dist/core/app/origin-check.js';
import { validateForwardedHeaders } from '../node_modules/astro/dist/core/app/validate-headers.js';
import config from '../astro.config.mjs';

const allowedDomains = config.security?.allowedDomains ?? [];

/** What Astro does per request: build the URL from the (plain HTTP) request, then let the forwarded headers correct it if `allowedDomains` permits. */
function rejects(
  host: string,
  headers: Record<string, string>,
  domains: typeof allowedDomains = allowedDomains,
): boolean {
  const request = new Request(`http://${host}/_actions/register`, {
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

/** `checkOrigin` defaults to true; an explicit `false` would be the wrong fix. */
function checkOriginStaysOn(): void {
  assert.equal(config.security?.checkOrigin, undefined);
}

/** Behind the TLS proxy, same-site form POSTs must pass Astro's origin check. */
function proxiedPostBehaviour(host: string): void {
  /** The proxy's own headers, as Traefik sends them in front of this app. */
  const proxied = { 'x-forwarded-proto': 'https', 'x-forwarded-host': host };

  // A form POST behind the TLS-terminating proxy is accepted.
  assert.equal(rejects(host, { origin: `https://${host}`, ...proxied }), false);
  // Without allowedDomains the forwarded protocol is ignored — the shipped bug.
  assert.equal(rejects(host, { origin: `https://${host}`, ...proxied }, []), true);

  // A genuine cross-site POST is still forbidden.
  assert.equal(rejects(host, { origin: 'https://evil.example', ...proxied }), true);
  assert.equal(rejects(host, { ...proxied }), true);

  // A spoofed x-forwarded-host is ignored, not trusted — this is what keeps
  // host-header injection out once allowedDomains is in play.
  assert.equal(
    rejects(host, {
      origin: 'https://evil.example',
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'evil.example',
    }),
    true,
  );
}

switch (process.argv[2]) {
  // No PUBLIC_SITE_URL at all: what a clean checkout and CI actually build.
  case 'default': {
    assert.equal(process.env.PUBLIC_SITE_URL, undefined);
    assert.deepEqual(allowedDomains, [{ hostname: 'mens-circle.de', protocol: 'https' }]);
    checkOriginStaysOn();
    proxiedPostBehaviour('mens-circle.de');
    break;
  }

  // A different deployment domain. Pins the derivation itself: the config has
  // to follow PUBLIC_SITE_URL, not a literal someone typed twice.
  case 'custom-domain': {
    assert.deepEqual(allowedDomains, [{ hostname: 'kreis.example.org', protocol: 'https' }]);
    checkOriginStaysOn();
    proxiedPostBehaviour('kreis.example.org');
    break;
  }

  // A plain-http localhost URL, which is what `.env` carries while someone runs the site locally.
  case 'local-http': {
    assert.deepEqual(allowedDomains, [{ hostname: 'localhost', protocol: 'http' }]);
    checkOriginStaysOn();
    // The production domain is not trusted just because it is the default.
    assert.equal(rejects('mens-circle.de', { origin: 'https://mens-circle.de' }), true);
    break;
  }

  default:
    throw new Error('Unknown forwarded-origin scenario');
}
