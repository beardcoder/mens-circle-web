/// <reference path="../../pb_data/types.d.ts" />

// Domain helpers shared by routes / hooks / cron: registration counting,
// event "is past" check, the public event DTO and the participant upsert.

const { config } = require(`${__hooks}/lib/config.js`);
const { toDate } = require(`${__hooks}/lib/format.js`);

// Count active registrations (status registered|attended, not soft-deleted) for an event.
function countActiveRegistrations(app, eventId) {
  try {
    const recs = app.findRecordsByFilter(
      "registrations",
      "event = {:eid} && deleted = null && (status = 'registered' || status = 'attended')",
      "",
      0,
      0,
      { eid: eventId }
    );
    return recs.length;
  } catch (e) {
    return 0;
  }
}

// Is the event in the past? (end of its day has passed)
function isEventPast(ev) {
  const d = toDate(ev.get("event_date"));
  if (!d) return false;
  const endOfDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59)
  );
  return endOfDay.getTime() < Date.now();
}

// Build the public DTO for an event record.
function eventDto(app, ev) {
  const activeCount = countActiveRegistrations(app, ev.id);
  const max = ev.getInt ? ev.getInt("max_participants") : ev.get("max_participants");
  const available = Math.max(0, max - activeCount);

  let imageUrl = null;
  const imageName = ev.getString("image");
  if (imageName) {
    let base = config.APP_URL;
    try {
      const settings = app.settings();
      if (settings && settings.meta && settings.meta.appURL) {
        base = settings.meta.appURL;
      }
    } catch (e) {
      // fall back to config.APP_URL
    }
    imageUrl = `${base}/api/files/${ev.collection().id}/${ev.id}/${imageName}`;
  }

  return {
    id: ev.id,
    title: ev.getString("title"),
    slug: ev.getString("slug"),
    description: ev.getString("description"),
    event_date: ev.getString("event_date"),
    start_time: ev.getString("start_time"),
    end_time: ev.getString("end_time"),
    location: ev.getString("location"),
    location_details: ev.getString("location_details"),
    street: ev.getString("street"),
    postal_code: ev.getString("postal_code"),
    city: ev.getString("city"),
    latitude: ev.get("latitude"),
    longitude: ev.get("longitude"),
    max_participants: max,
    cost_basis: ev.getString("cost_basis"),
    image_url: imageUrl,
    available_spots: available,
    is_full: available <= 0,
    is_past: isEventPast(ev),
  };
}

// Find or create a participant by email; update name/phone on hit.
function upsertParticipant(app, email, fields) {
  let participant = null;
  try {
    participant = app.findFirstRecordByFilter(
      "participants",
      "email = {:email}",
      { email: email }
    );
  } catch (e) {
    participant = null;
  }

  if (!participant) {
    const col = app.findCollectionByNameOrId("participants");
    participant = new Record(col);
    participant.set("email", email);
  }
  if (fields) {
    if (fields.first_name !== undefined && fields.first_name !== null && fields.first_name !== "") {
      participant.set("first_name", fields.first_name);
    }
    if (fields.last_name !== undefined && fields.last_name !== null && fields.last_name !== "") {
      participant.set("last_name", fields.last_name);
    }
    if (fields.phone !== undefined && fields.phone !== null && fields.phone !== "") {
      participant.set("phone", fields.phone);
    }
  }
  app.save(participant);
  return participant;
}

module.exports = {
  countActiveRegistrations,
  isEventPast,
  eventDto,
  upsertParticipant,
};
