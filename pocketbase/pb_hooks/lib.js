/// <reference path="../pb_data/types.d.ts" />

// Barrel for the Männerkreis PocketBase hook helpers. NOT named *.pb.js so
// PocketBase does NOT auto-load it as a hook file. Require it from any *.pb.js
// handler with:  const lib = require(`${__hooks}/lib.js`)
//
// IMPORTANT: every *.pb.js handler (routerAdd, onRecord*, onBootstrap, cron)
// runs in an ISOLATED runtime — it cannot see top-level functions/vars from its
// own file. So the require() must happen INSIDE the handler body, and all shared
// logic lives in these `lib/` modules (required here and re-exported):
//
//   lib/config.js       env-backed config
//   lib/format.js       html-escape / date / address formatters
//   lib/ics.js          iCalendar (.ics) builder
//   lib/mail.js         sendMail + hosted .ics URL
//   lib/listmonk.js     newsletter + per-event list integration
//   lib/emails.js       German email renderers → { subject, html }
//   lib/domain.js       registration counting, event DTO, participant upsert
//   lib/registration.js registration email orchestration

const { config } = require(`${__hooks}/lib/config.js`);
const format = require(`${__hooks}/lib/format.js`);
const ics = require(`${__hooks}/lib/ics.js`);
const mail = require(`${__hooks}/lib/mail.js`);
const listmonk = require(`${__hooks}/lib/listmonk.js`);
const emails = require(`${__hooks}/lib/emails.js`);
const domain = require(`${__hooks}/lib/domain.js`);
const registration = require(`${__hooks}/lib/registration.js`);

module.exports = Object.assign(
  { config },
  format,
  ics,
  mail,
  listmonk,
  emails,
  domain,
  registration
);
