/// <reference path="../pb_data/types.d.ts" />

// config.pb.js — boot-time sanity log of the shared configuration.
// The actual shared constants + helpers live in lib.js (required by each hook file)
// because PocketBase hook files do NOT share scope across files.
onBootstrap((e) => {
  e.next();
  try {
    const lib = require(`${__hooks}/lib.js`);
    $app
      .logger()
      .info(
        "Männerkreis hooks loaded",
        "site_name",
        lib.config.SITE_NAME,
        "app_url",
        lib.config.APP_URL,
        "from",
        lib.config.MAIL_FROM_ADDRESS,
        "admin",
        lib.config.MAIL_ADMIN_ADDRESS
      );
  } catch (err) {
    $app.logger().error("Failed to load lib.js config", "error", String(err));
  }

  // Turnkey config: seed SMTP + sender identity + app URL from environment
  // variables on every boot so a Coolify deployment works by setting env vars
  // alone (no manual admin clicking). Only applies values that are present.
  // Also enables anti-spam rate limiting on the public POST routes. Both are
  // applied to a single settings object and saved once.
  try {
    const settings = $app.settings();
    let dirty = false;

    const smtpHost = $os.getenv("SMTP_HOST");
    const fromAddress = $os.getenv("MAIL_FROM_ADDRESS");
    const fromName = $os.getenv("MAIL_FROM_NAME");
    const appUrl = $os.getenv("APP_URL");
    if (smtpHost || fromAddress || appUrl) {
      if (appUrl) settings.meta.appURL = appUrl;
      if (fromName) settings.meta.senderName = fromName;
      if (fromAddress) settings.meta.senderAddress = fromAddress;
      if (smtpHost) {
        settings.smtp.enabled = true;
        settings.smtp.host = smtpHost;
        settings.smtp.port = parseInt($os.getenv("SMTP_PORT") || "587", 10);
        settings.smtp.username = $os.getenv("SMTP_USERNAME") || "";
        settings.smtp.password = $os.getenv("SMTP_PASSWORD") || "";
        // PocketBase TLS = implicit TLS (port 465). For STARTTLS (587) leave false.
        settings.smtp.tls = ($os.getenv("SMTP_TLS") || "false") === "true";
      }
      dirty = true;
    }

    // Behind the in-container Bun edge proxy every request originates from
    // 127.0.0.1, so trust the X-Forwarded-For chain to recover the real client
    // IP. Without this the rate limiting below would bucket ALL callers into a
    // single (loopback) IP. The Bun edge (server/entry.ts) appends its hop to
    // XFF, preserving the client IP forwarded by Coolify's outer proxy.
    try {
      settings.trustedProxies.headers = ["X-Forwarded-For"];
      settings.trustedProxies.useLeftmostIP = true;
      dirty = true;
    } catch (tpErr) {
      $app.logger().error("Failed to set trusted proxies", "error", String(tpErr));
    }

    // Anti-spam rate limiting on the public submission endpoints. Idempotent:
    // we replace the rules array each boot so the config is fully driven here.
    // RateLimitRule = { label, audience, duration (seconds), maxRequests }.
    // An empty audience ("") applies the rule to all callers (guests + auth).
    try {
      settings.rateLimits.enabled = true;
      settings.rateLimits.rules = [
        { label: "POST /api/event/register", maxRequests: 5, duration: 3600, audience: "" },
        { label: "POST /api/newsletter/subscribe", maxRequests: 5, duration: 3600, audience: "" },
        { label: "POST /api/testimonial/submit", maxRequests: 3, duration: 3600, audience: "" },
      ];
      dirty = true;
      $app.logger().info("Applied rate-limit rules from hooks");
    } catch (rlErr) {
      $app.logger().error("Failed to apply rate limits", "error", String(rlErr));
    }

    if (dirty) {
      $app.save(settings);
      $app.logger().info("Applied SMTP/sender/rate-limit settings");
    }
  } catch (err) {
    $app.logger().error("Failed to apply env settings", "error", String(err));
  }
});
