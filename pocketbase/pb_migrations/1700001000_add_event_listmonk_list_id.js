/// <reference path="../pb_data/types.d.ts" />

// Add `listmonk_list_id` to events: the numeric ID of the per-event listmonk
// list that participants are subscribed to on registration. Lets the admin
// message exactly the people who signed up for a given event. 0/empty means no
// list has been created yet (created lazily on first registration or on event
// create — see pb_hooks/events.pb.js + lib.js).
migrate((app) => {
  const collection = app.findCollectionByNameOrId("events");
  collection.fields.add(
    new Field({
      type: "number",
      name: "listmonk_list_id",
      required: false,
      min: 0,
      onlyInt: true,
    })
  );
  app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("events");
  const field = collection.fields.getByName("listmonk_list_id");
  if (field) {
    collection.fields.removeById(field.id);
    app.save(collection);
  }
});
