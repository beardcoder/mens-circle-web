/// <reference path="../pb_data/types.d.ts" />

// events (base) per spec §1.1. Public read only for published, non-deleted events.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "events",
    listRule: "is_published = true && deleted = null",
    viewRule: "is_published = true && deleted = null",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "text",
        name: "title",
        required: true,
        max: 255,
      },
      {
        type: "text",
        name: "slug",
        required: true,
        max: 255,
      },
      {
        type: "editor",
        name: "description",
        required: false,
      },
      {
        type: "date",
        name: "event_date",
        required: true,
      },
      {
        type: "text",
        name: "start_time",
        required: false,
        max: 16,
      },
      {
        type: "text",
        name: "end_time",
        required: false,
        max: 16,
      },
      {
        type: "text",
        name: "location",
        required: false,
        max: 255,
      },
      {
        type: "text",
        name: "location_details",
        required: false,
        max: 1000,
      },
      {
        type: "text",
        name: "street",
        required: false,
        max: 255,
      },
      {
        type: "text",
        name: "postal_code",
        required: false,
        max: 32,
      },
      {
        type: "text",
        name: "city",
        required: false,
        max: 255,
      },
      {
        type: "number",
        name: "latitude",
        required: false,
      },
      {
        type: "number",
        name: "longitude",
        required: false,
      },
      {
        type: "number",
        name: "max_participants",
        required: true,
        min: 0,
      },
      {
        type: "text",
        name: "cost_basis",
        required: false,
        max: 255,
      },
      {
        type: "bool",
        name: "is_published",
        required: false,
      },
      {
        type: "file",
        name: "image",
        required: false,
        maxSelect: 1,
        maxSize: 5242880,
        mimeTypes: [
          "image/jpeg",
          "image/png",
          "image/webp",
          "image/gif",
        ],
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
      "CREATE UNIQUE INDEX `idx_events_slug` ON `events` (`slug`)",
    ],
  });

  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("events"));
});
