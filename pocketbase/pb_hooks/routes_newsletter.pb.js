/// <reference path="../pb_data/types.d.ts" />

// POST /api/newsletter/subscribe — forwards the sign-up to listmonk's admin
// API; listmonk owns the (double) opt-in confirmation, campaigns and unsubscribe.
routerAdd("POST", "/api/newsletter/subscribe", (e) => {
  const lib = require(`${__hooks}/lib.js`);
  try {
    const data = e.requestInfo().body || {};
    const email = (data.email || "").trim().toLowerCase();
    const name = (data.name || "").trim();

    // Honeypot: hidden "website" field; bots fill it. Fake success silently.
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return e.json(200, {
        success: true,
        message:
          "Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.",
      });
    }

    if (!email || email.indexOf("@") === -1) {
      return e.json(422, {
        success: false,
        message: "Bitte gib eine gültige E-Mail-Adresse an.",
      });
    }

    // Subscribers + sending live entirely in listmonk now. Forward the sign-up
    // to listmonk's admin API; it owns the (double) opt-in confirmation email.
    const result = lib.subscribeToListmonk(email, name);

    if (result.status === "exists") {
      return e.json(409, {
        success: false,
        message: "Diese E-Mail-Adresse ist bereits für den Newsletter angemeldet.",
      });
    }

    if (!result.ok) {
      return e.json(502, {
        success: false,
        message: "Die Anmeldung ist momentan nicht möglich. Bitte versuche es später erneut.",
      });
    }

    return e.json(200, {
      success: true,
      message:
        "Vielen Dank! Du hast dich erfolgreich für unseren Newsletter angemeldet. Schau in dein Postfach.",
    });
  } catch (err) {
    $app.logger().error("/api/newsletter/subscribe failed", "error", String(err));
    return e.json(500, {
      success: false,
      message: "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
    });
  }
});
