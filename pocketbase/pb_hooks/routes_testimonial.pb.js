/// <reference path="../pb_data/types.d.ts" />

// POST /api/testimonial/submit — public testimonial submission. Always stored
// unpublished/unmoderated; an admin reviews before it goes live.
routerAdd("POST", "/api/testimonial/submit", (e) => {
  try {
    const data = e.requestInfo().body || {};
    const quote = (data.quote || "").trim();
    const authorName = (data.author_name || "").trim();
    const role = (data.role || "").trim();
    const email = (data.email || "").trim().toLowerCase();
    const privacy = data.privacy;

    // Honeypot: hidden "website" field; bots fill it. Fake success silently
    // (no testimonial record created).
    if (typeof data.website === "string" && data.website.trim() !== "") {
      return e.json(200, {
        success: true,
        message:
          "Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.",
      });
    }

    if (privacy !== true && privacy !== "true" && privacy !== 1 && privacy !== "1") {
      return e.json(422, {
        success: false,
        message: "Bitte bestätige die Datenschutzerklärung.",
      });
    }
    if (quote.length < 10 || quote.length > 1000) {
      return e.json(422, {
        success: false,
        message: "Dein Testimonial muss zwischen 10 und 1000 Zeichen lang sein.",
      });
    }
    if (email && email.indexOf("@") === -1) {
      return e.json(422, {
        success: false,
        message: "Bitte gib eine gültige E-Mail-Adresse an.",
      });
    }

    const col = $app.findCollectionByNameOrId("testimonials");
    const rec = new Record(col);
    rec.set("quote", quote);
    rec.set("author_name", authorName);
    rec.set("role", role);
    if (email) rec.set("email", email);
    // Always forced unpublished / unmoderated.
    rec.set("is_published", false);
    rec.set("published_at", null);
    rec.set("sort_order", 0);
    $app.save(rec);

    return e.json(200, {
      success: true,
      message:
        "Vielen Dank! Dein Testimonial wurde eingereicht und wird nach Prüfung veröffentlicht.",
    });
  } catch (err) {
    $app.logger().error("/api/testimonial/submit failed", "error", String(err));
    return e.json(500, {
      success: false,
      message: "Es ist ein Fehler aufgetreten. Bitte versuche es später erneut.",
    });
  }
});
