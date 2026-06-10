/// <reference path="../pb_data/types.d.ts" />

// registrations (base) per spec §1.3. Created via custom route, not public record create.
migrate((app) => {
  const participants = app.findCollectionByNameOrId("participants");
  const events = app.findCollectionByNameOrId("events");

  const collection = new Collection({
    type: "base",
    name: "registrations",
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
        type: "relation",
        name: "event",
        required: true,
        collectionId: events.id,
        maxSelect: 1,
        cascadeDelete: true,
      },
      {
        type: "select",
        name: "status",
        required: true,
        maxSelect: 1,
        values: ["registered", "waitlist", "cancelled", "attended"],
      },
      {
        type: "date",
        name: "registered_at",
        required: false,
      },
      {
        type: "date",
        name: "cancelled_at",
        required: false,
      },
      {
        type: "date",
        name: "reminder_sent_at",
        required: false,
      },
      {
        type: "date",
        name: "sms_reminder_sent_at",
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
      "CREATE UNIQUE INDEX `idx_registrations_participant_event` ON `registrations` (`participant`, `event`)",
    ],
  });

  app.save(collection);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("registrations"));
});
