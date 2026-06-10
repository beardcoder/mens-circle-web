/// <reference path="../pb_data/types.d.ts" />

// Seed ONE published sample event so the public /event page works out of the box.
// Guarded against duplicate seeding (find-by-slug first).
const SAMPLE_SLUG = "maennerkreis-test-termin";

migrate((app) => {
  // Skip if already seeded.
  try {
    const existing = app.findFirstRecordByFilter(
      "events",
      "slug = {:slug}",
      { slug: SAMPLE_SLUG }
    );
    if (existing) {
      return;
    }
  } catch (err) {
    // not found -> proceed to seed
  }

  const collection = app.findCollectionByNameOrId("events");
  const record = new Record(collection);

  record.set("title", "Männerkreis Niederbayern/ Straubing – Test-Termin");
  record.set("slug", SAMPLE_SLUG);
  record.set(
    "description",
    "Der Männerkreis ist ein regelmäßiges Treffen von Männern, die sich nach echtem Austausch und authentischer Verbindung sehnen. In einem geschützten Rahmen teilen wir unsere Erfahrungen, Herausforderungen und Erkenntnisse.\n\nEs ist keine Vorerfahrung nötig – bringe einfach dich selbst mit, so wie du gerade bist. Wir freuen uns auf dich!"
  );
  record.set("event_date", "2026-07-15 19:00:00.000Z");
  record.set("start_time", "19:00");
  record.set("end_time", "21:30");
  record.set("location", "Straubing");
  record.set(
    "location_details",
    "Die genaue Adresse erhältst du nach deiner Anmeldung per E-Mail."
  );
  record.set("city", "Straubing");
  record.set("postal_code", "94315");
  record.set("latitude", 48.8777);
  record.set("longitude", 12.5731);
  record.set("max_participants", 8);
  record.set("cost_basis", "Auf Spendenbasis");
  record.set("is_published", true);

  app.save(record);
}, (app) => {
  try {
    const record = app.findFirstRecordByFilter(
      "events",
      "slug = {:slug}",
      { slug: SAMPLE_SLUG }
    );
    if (record) {
      app.delete(record);
    }
  } catch (err) {
    // already gone
  }
});
