/// <reference path="../pb_data/types.d.ts" />

// testimonials (base) per spec §1.6. Public read only published; create via custom route.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "testimonials",
    listRule: "is_published = true",
    viewRule: "is_published = true",
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "text",
        name: "quote",
        required: true,
        min: 10,
        max: 1000,
      },
      {
        type: "text",
        name: "author_name",
        required: false,
        max: 255,
      },
      {
        type: "email",
        name: "email",
        required: false,
      },
      {
        type: "text",
        name: "role",
        required: false,
        max: 255,
      },
      {
        type: "bool",
        name: "is_published",
        required: false,
      },
      {
        type: "date",
        name: "published_at",
        required: false,
      },
      {
        type: "number",
        name: "sort_order",
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
  });

  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("testimonials"));
});
