/**
 * Executed only by forwarded-origin.test.ts, in a child process started with
 * `--no-env-file` and an explicit environment. That isolation is the point:
 * `astro.config.mjs` derives `security.allowedDomains` from `PUBLIC_SITE_URL`
 * at module load, so reading the config in-process measured whatever the
 * developer happened to have in `.env` — and a local `.env` pointing at
 * localhost failed the suite while the shipped config was fine.
 *
 * Each scenario therefore names the site URL it wants and checks what the
 * config derives from it, which tests the derivation instead of the ambient
 * result.
 */
import assert from 'node:assert/strict';
// Deep imports: these two modules are the code that decides, and Astro exports
// neither. If an upgrade moves them the import fails loudly — re-verify the fix
// then rather than deleting this test.
import { isForbiddenCrossOriginRequest } from '../node_modules/astro/dist/core/app/origin-check.js';
import { validateForwardedHeaders } from '../node_modules/astro/dist/core/app/validate-headers.js';
import config from '../astro.config.mjs';

// Astro types this as `Partial<RemotePattern>[]`; keep that type rather than a
// narrower local one, so the deep imports above stay the only place this file
// assumes anything about Astro's internals.
const allowedDomains = config.security?.allowedDomains ?? [];

/**
 * What Astro does per request: build the URL from the (plain HTTP) request,
 * then let the forwarded headers correct it if `allowedDomains` permits.
 * Mirrors RenderContext#applyForwardedHeaders.
 */
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

/**
 * The regression this file exists for: TLS terminates at the Coolify/Traefik
 * proxy, so the Bun process sees plain HTTP while the browser's `Origin` says
 * https, and every Anmeldung answered 403 "Cross-site POST form submissions are
 * forbidden". Runs against whichever https host the scenario configured, so it
 * proves the behaviour rather than one hard-coded domain.
 */
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

  // A plain-http localhost URL, which is what `.env` carries while someone runs
  // the site locally. The derivation must still hold — and it must NOT keep
  // claiming https for a host that is configured as http, or the CSRF check
  // would trust a protocol nobody configured. No proxy sits in front of a local
  // dev server, so the https repair above is not what this case is about.
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
