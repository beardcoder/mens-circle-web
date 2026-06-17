/// <reference path="../../pb_data/types.d.ts" />

// Env-backed configuration shared by all hooks. Part of the `lib/` modules that
// back the `lib.js` barrel. Required (directly or via the barrel) INSIDE each
// hook handler, since every *.pb.js handler runs in an isolated runtime.

// Read an env var via $os.getenv with a fallback.
function env(key, fallback) {
  try {
    const v = $os.getenv(key);
    return v && v.length > 0 ? v : fallback;
  } catch (e) {
    return fallback;
  }
}

// Parse a comma-separated list of integers (e.g. "1,3,4") into a number array.
function parseIntList(raw) {
  if (!raw) return [];
  var out = [];
  String(raw)
    .split(",")
    .forEach(function (s) {
      var token = s.trim();
      if (token === "") return;
      var n = parseInt(token, 10);
      // listmonk's admin API expects numeric list IDs, not UUIDs. A UUID here
      // would silently become NaN and drop out — log it loudly so the
      // misconfiguration is obvious instead of "nobody gets assigned".
      if (isNaN(n) || String(n) !== token) {
        $app.logger().warn(
          "parseIntList: ignoring non-numeric list id — expected the numeric listmonk list ID, not a UUID",
          "value",
          token,
        );
        return;
      }
      out.push(n);
    });
  return out;
}

const config = {
  APP_URL: env("APP_URL", "https://mens-circle.de"),
  SITE_NAME: env("SITE_NAME", "Männerkreis Niederbayern/ Straubing"),
  MAIL_FROM_ADDRESS: env("MAIL_FROM_ADDRESS", "hallo@mens-circle.de"),
  MAIL_FROM_NAME: env("MAIL_FROM_NAME", "Männerkreis Niederbayern/ Straubing"),
  MAIL_ADMIN_ADDRESS: env("MAIL_ADMIN_ADDRESS", "hallo@mens-circle.de"),
  MAIL_ADMIN_NAME: env("MAIL_ADMIN_NAME", "Männerkreis Admin"),
  CONTACT_EMAIL: env("MAIL_CONTACT_ADDRESS", "hallo@mens-circle.de"),

  // listmonk — newsletter subscribers + campaigns now live here (not PocketBase).
  // The public subscribe route forwards new sign-ups to listmonk's admin API;
  // sending campaigns, double opt-in and unsubscribe are handled inside listmonk.
  LISTMONK_URL: env("LISTMONK_URL", "").replace(/\/+$/, ""),
  LISTMONK_API_USER: env("LISTMONK_API_USER", ""),
  LISTMONK_API_TOKEN: env("LISTMONK_API_TOKEN", ""),
  LISTMONK_LIST_IDS: parseIntList(env("LISTMONK_LIST_IDS", "")),
};

module.exports = { env, parseIntList, config };
