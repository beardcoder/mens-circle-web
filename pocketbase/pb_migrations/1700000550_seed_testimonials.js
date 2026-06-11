/// <reference path="../pb_data/types.d.ts" />

// Seed the original published testimonials so the (PocketBase-backed)
// testimonials section has content out of the box. Guarded against duplicate
// seeding. Admins can edit/unpublish/add more in the dashboard; new public
// submissions arrive unpublished for moderation.
const SEED = [
  {
    quote:
      "Hier kann ich endlich ich selbst sein, ohne Maske und ohne Leistungsdruck. Der Kreis hat mir einen Raum gegeben, in dem ich mich verletzlich zeigen darf.",
    author_name: "Michael",
    role: "Teilnehmer seit 2023",
  },
  {
    quote:
      "Der Kreis hat mir gezeigt, dass ich mit meinen Gefühlen und Zweifeln nicht alleine bin. Das hat mir unglaublich viel Kraft gegeben.",
    author_name: "",
    role: "",
  },
  {
    quote:
      "Eine Oase der Ehrlichkeit in einer Welt voller Fassaden. Hier wird nicht geurteilt, sondern zugehört.",
    author_name: "Stefan",
    role: "Teilnehmer seit 2022",
  },
  {
    quote:
      "Hier habe ich gelernt, dass Verletzlichkeit keine Schwäche ist, sondern der Mut, sich zu zeigen wie man wirklich ist.",
    author_name: "",
    role: "",
  },
  {
    quote:
      "Zum ersten Mal habe ich Männer kennengelernt, die wirklich zuhören können. Das hat meine Sicht auf Männlichkeit komplett verändert.",
    author_name: "Thomas",
    role: "Gründungsmitglied",
  },
  {
    quote:
      "Der Kreis ist ein Raum, in dem ich mich fallen lassen kann. Hier muss ich nicht funktionieren oder stark sein.",
    author_name: "",
    role: "Teilnehmer seit 2024",
  },
];

migrate((app) => {
  // Skip if any testimonial already exists.
  try {
    const existing = app.findFirstRecordByFilter("testimonials", "id != ''");
    if (existing) return;
  } catch (err) {
    // none -> proceed
  }

  const collection = app.findCollectionByNameOrId("testimonials");
  const publishedAt = "2026-01-01 00:00:00.000Z";

  SEED.forEach((t, i) => {
    const record = new Record(collection);
    record.set("quote", t.quote);
    record.set("author_name", t.author_name);
    record.set("role", t.role);
    record.set("is_published", true);
    record.set("published_at", publishedAt);
    record.set("sort_order", i + 1);
    app.save(record);
  });
}, (app) => {
  // Down: remove the seeded quotes by their exact text.
  SEED.forEach((t) => {
    try {
      const record = app.findFirstRecordByFilter("testimonials", "quote = {:q}", {
        q: t.quote,
      });
      if (record) app.delete(record);
    } catch (err) {
      // already gone
    }
  });
});
