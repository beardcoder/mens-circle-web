/// <reference path="../pb_data/types.d.ts" />

// newsletters (base) per spec §1.5. Superuser-authored campaigns.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "newsletters",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "text",
        name: "subject",
        required: true,
        max: 255,
      },
      {
        type: "editor",
        name: "content",
        required: true,
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["draft", "sending", "sent"],
      },
      {
        type: "date",
        name: "sent_at",
        required: false,
      },
      {
        type: "number",
        name: "recipient_count",
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
  });

  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("newsletters"));
});
