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
  try {
    const smtpHost = $os.getenv("SMTP_HOST");
    const fromAddress = $os.getenv("MAIL_FROM_ADDRESS");
    const fromName = $os.getenv("MAIL_FROM_NAME");
    const appUrl = $os.getenv("APP_URL");
    if (smtpHost || fromAddress || appUrl) {
      const settings = $app.settings();
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
      $app.save(settings);
      $app.logger().info("Applied SMTP/sender settings from environment");
    }
  } catch (err) {
    $app.logger().error("Failed to apply env settings", "error", String(err));
  }
});
