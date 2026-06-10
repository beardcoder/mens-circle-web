/// <reference path="../pb_data/types.d.ts" />

// newsletter_subscribers (base) per spec §1.4. Admin-only read.
migrate((app) => {
  const participants = app.findCollectionByNameOrId("participants");

  const collection = new Collection({
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
      {
        type: "text",
        name: "token",
        required: true,
        max: 128,
      },
      {
        type: "date",
        name: "subscribed_at",
        required: false,
      },
      {
        type: "date",
        name: "confirmed_at",
        required: false,
      },
      {
        type: "date",
        name: "unsubscribed_at",
        required: false,
      },
      {
        type: "date",
        name: "deleted",
        required: false,
      },
      {
        type: "autodate",
        name: "created",
        onCreate: true,
        onUpdate: false,
      },
      {
        type: "autodate",
        name: "updated",
        onCreate: true,
        onUpdate: true,
      },
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_newsletter_subscribers_participant` ON `newsletter_subscribers` (`participant`)",
      "CREATE UNIQUE INDEX `idx_newsletter_subscribers_token` ON `newsletter_subscribers` (`token`)",
    ],
  });

  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("newsletter_subscribers"));
});
