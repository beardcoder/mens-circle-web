/// <reference path="../pb_data/types.d.ts" />

// deploy_state — single-row bookkeeping collection for the deploy-webhook
// debounce (see pb_hooks/deploy.pb.js + lib.js). Not publicly accessible.
// requested_at = last content change; triggered_at = last rebuild fired.
migrate((app) => {
  const collection = new Collection({
    type: "base",
    name: "deploy_state",
    listRule: null,
    viewRule: null,
    createRule: null,
    updateRule: null,
    deleteRule: null,
    fields: [
      {
        type: "text",
        name: "key",
        required: true,
        max: 50,
      },
      {
        type: "date",
        name: "requested_at",
        required: false,
      },
      {
        type: "date",
        name: "triggered_at",
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
      "CREATE UNIQUE INDEX `idx_deploy_state_key` ON `deploy_state` (`key`)",
    ],
  });

  app.save(collection);

  // Seed the singleton row the deploy helpers read/update.
  const rec = new Record(collection);
  rec.set("key", "singleton");
  app.save(rec);
}, (app) => {
  app.delete(app.findCollectionByNameOrId("deploy_state"));
});
