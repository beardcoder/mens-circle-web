/// <reference path="../pb_data/types.d.ts" />

// participants (base): shared, deduped by unique email. Contains PII -> superuser-only rules.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "participants",
    // null rules = superuser-only access in PocketBase
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "text",
        name: "first_name",
        required: false,
        max: 255,
      },
      {
        type: "text",
        name: "last_name",
        required: false,
        max: 255,
      },
      {
        type: "email",
        name: "email",
        required: true,
      },
      {
        type: "text",
        name: "phone",
        required: false,
        max: 64,
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
      "CREATE UNIQUE INDEX `idx_participants_email` ON `participants` (`email`)",
    ],
  });

  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("participants"));
});
