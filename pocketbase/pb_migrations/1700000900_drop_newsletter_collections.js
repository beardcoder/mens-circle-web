/// <reference path="../pb_data/types.d.ts" />

// Newsletter subscribers + campaigns moved to listmonk. PocketBase no longer
// stores any newsletter data, so drop the now-unused collections. The `down`
// migration recreates them with their original schema (see the
// 1700000300 / 1700000400 init migrations) for a clean rollback.
migrate((app) => {
  ["newsletters", "newsletter_subscribers"].forEach((name) => {
    try {
      app.delete(app.findCollectionByNameOrId(name));
    } catch (e) {
      // Already absent — nothing to drop.
    }
  });
}, (app) => {
  // Re-create newsletter_subscribers (base) — admin-only read.
  const participants = app.findCollectionByNameOrId("participants");
  const subscribers = new Collection({
    type: "base",
    name: "newsletter_subscribers",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "relation",
        name: "participant",
        required: true,
        collectionId: participants.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      { type: "text", name: "token", required: true, max: 128 },
      { type: "date", name: "subscribed_at", required: false },
      { type: "date", name: "confirmed_at", required: false },
      { type: "date", name: "unsubscribed_at", required: false },
      { type: "date", name: "deleted", required: false },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_newsletter_subscribers_participant` ON `newsletter_subscribers` (`participant`)",
      "CREATE UNIQUE INDEX `idx_newsletter_subscribers_token` ON `newsletter_subscribers` (`token`)",
    ],
  });
  app.save(subscribers);

  // Re-create newsletters (base) — superuser-authored campaigns.
  const newsletters = new Collection({
    type: "base",
    name: "newsletters",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      { type: "text", name: "subject", required: true, max: 255 },
      { type: "editor", name: "content", required: true },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["draft", "sending", "sent"],
      },
      { type: "date", name: "sent_at", required: false },
      { type: "number", name: "recipient_count", required: false },
      { type: "autodate", name: "created", onCreate: true, onUpdate: false },
      { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
    ],
  });
  app.save(newsletters);
});
