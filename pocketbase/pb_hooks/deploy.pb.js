/// <reference path="../pb_data/types.d.ts" />

// deploy.pb.js — rebuild the static frontend when statically-rendered content
// changes.
//
// Events and testimonials are rendered into the HTML at BUILD time (see the
// Astro pages and src/lib/pocketbase-build.ts). A change to those records only
// becomes visible after the site is rebuilt + redeployed, so on every relevant
// change we ping a deploy webhook. The actual debounce + webhook logic lives in
// lib.js (required here) because PocketBase JSVM hook handlers run in isolated
// scopes and cannot share in-memory state or reference other top-level
// functions in this file.
//
// Enable by setting DEPLOY_WEBHOOK_URL (+ optional METHOD/TOKEN/COOLDOWN_SEC).
// Without it, all of this is a no-op.

// Leading-edge trigger on create/update/delete of events + testimonials.
function onContentChange(e) {
  try {
    const lib = require(`${__hooks}/lib.js`);
    let reason = "content";
    try {
      if (e.record) reason = e.record.collection().name;
    } catch (nameErr) {
      // collection name unavailable (e.g. on delete) — fall back to "content"
    }
    lib.requestDeploy($app, reason);
  } catch (err) {
    $app.logger().error("deploy trigger failed", "error", String(err));
  }
  e.next();
}

onRecordAfterCreateSuccess(onContentChange, "events", "testimonials");
onRecordAfterUpdateSuccess(onContentChange, "events", "testimonials");
onRecordAfterDeleteSuccess(onContentChange, "events", "testimonials");

// Trailing-edge sweep: catches the last change of a burst that was suppressed
// by the cooldown. Runs every minute; a no-op unless a rebuild is pending.
cronAdd("deploy-trailing-sweep", "* * * * *", () => {
  try {
    const lib = require(`${__hooks}/lib.js`);
    lib.sweepDeploy($app);
  } catch (err) {
    $app.logger().error("deploy sweep failed", "error", String(err));
  }
});
