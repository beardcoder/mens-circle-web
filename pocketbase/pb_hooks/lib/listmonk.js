/// <reference path="../../pb_data/types.d.ts" />

// listmonk integration — newsletter subscribers (LISTMONK_LIST_IDS) AND the
// per-event lists. Subscribers live in listmonk, not PocketBase; listmonk owns
// the double opt-in, campaign sending and unsubscribe flows.
//
// The per-event API behaviour was verified end-to-end against listmonk v6.1.0:
//   • POST /api/subscribers              — create; 409 if the email exists.
//   • PUT  /api/subscribers/lists        — additive (action:add). Adds the
//     target lists with the given status and NEVER changes the subscription
//     status of the subscriber's other lists.
//   • PUT  /api/subscribers/{id}         — OVERWRITES the subscriber's list
//     membership with the `lists` array, so the name update always re-sends the
//     UNION of the current list IDs. With preconfirm_subscriptions:false it
//     preserves each existing list's confirmation status (it neither downgrades
//     a confirmed list nor confirms a pending double-opt-in newsletter).

const { config } = require(`${__hooks}/lib/config.js`);
const { formatDateShortDE } = require(`${__hooks}/lib/format.js`);

// True only when the listmonk admin API is fully configured for the newsletter
// (URL + user + token + at least one list id).
function listmonkConfigured() {
  return (
    config.LISTMONK_URL.length > 0 &&
    config.LISTMONK_API_USER.length > 0 &&
    config.LISTMONK_API_TOKEN.length > 0 &&
    config.LISTMONK_LIST_IDS.length > 0
  );
}

// True when the listmonk admin API base is configured (URL + user + token).
// Unlike listmonkConfigured() this does NOT require LISTMONK_LIST_IDS: event
// lists are created and managed independently of the newsletter list(s).
function listmonkApiConfigured() {
  return (
    config.LISTMONK_URL.length > 0 &&
    config.LISTMONK_API_USER.length > 0 &&
    config.LISTMONK_API_TOKEN.length > 0
  );
}

// Low-level call to the listmonk admin API. Never throws — returns the raw
// PocketBase $http response (or null on transport failure).
function listmonkRequest(method, path, bodyObj) {
  try {
    return $http.send({
      url: config.LISTMONK_URL + path,
      method: method,
      // listmonk v2+ supports API tokens via the "token user:token" scheme.
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "token " + config.LISTMONK_API_USER + ":" + config.LISTMONK_API_TOKEN,
      },
      body: bodyObj ? JSON.stringify(bodyObj) : undefined,
      timeout: 15,
    });
  } catch (err) {
    $app.logger().error("listmonk request failed", "path", path, "error", String(err));
    return null;
  }
}

// Subscribe an email to the configured newsletter list(s).
// Returns { ok, status } where status is one of:
//   "subscribed" — newly added (listmonk sends opt-in if the list is double opt-in)
//   "exists"     — the address is already a subscriber
//   "error"      — listmonk rejected the request or is unreachable
function subscribeToListmonk(email, name) {
  if (!listmonkConfigured()) {
    $app.logger().error("listmonk not configured — set LISTMONK_URL / LISTMONK_API_USER / LISTMONK_API_TOKEN / LISTMONK_LIST_IDS");
    return { ok: false, status: "error" };
  }

  // Adding without preconfirm lets listmonk drive the (double) opt-in flow per
  // the list configuration. A non-empty name is required by some listmonk
  // builds, so fall back to the address.
  const res = listmonkRequest("POST", "/api/subscribers", {
    email: email,
    name: name && name.trim() ? name.trim() : email,
    status: "enabled",
    lists: config.LISTMONK_LIST_IDS,
    preconfirm_subscriptions: false,
  });

  if (!res) return { ok: false, status: "error" };

  if (res.statusCode >= 200 && res.statusCode < 300) {
    return { ok: true, status: "subscribed" };
  }

  // 409 = the email is already a subscriber in listmonk.
  if (res.statusCode === 409) {
    return { ok: true, status: "exists" };
  }

  let detail = "";
  try {
    detail = JSON.stringify(res.json);
  } catch (e) {
    detail = "";
  }
  $app.logger().error("listmonk subscribe rejected", "email", email, "status", res.statusCode, "body", detail);
  return { ok: false, status: "error" };
}

// Human-readable listmonk list name for an event, e.g.
// "Event: Sommer-Retreat (15.07.2026)".
function eventListName(ev) {
  const title = (ev.getString("title") || "Veranstaltung").trim();
  const date = formatDateShortDE(ev.get("event_date"));
  return date ? `Event: ${title} (${date})` : `Event: ${title}`;
}

// Create a private, single-opt-in listmonk list. Single opt-in because event
// registrants have already opted in by registering — we don't want to send them
// a separate listmonk confirmation. Returns { ok, id }.
function listmonkCreateList(name) {
  const res = listmonkRequest("POST", "/api/lists", {
    name: name,
    type: "private",
    optin: "single",
    tags: ["event"],
  });
  if (!res) return { ok: false, id: 0 };
  if (res.statusCode >= 200 && res.statusCode < 300) {
    let id = 0;
    try {
      id = res.json.data.id;
    } catch (e) {
      id = 0;
    }
    return { ok: id > 0, id: id };
  }
  $app.logger().error("listmonk create list rejected", "name", name, "status", res.statusCode);
  return { ok: false, id: 0 };
}

// Best-effort rename of an existing listmonk list (keeps the list label in sync
// when an event's title or date changes). Returns true on success.
function listmonkRenameList(listId, name) {
  const res = listmonkRequest("PUT", "/api/lists/" + listId, {
    name: name,
    type: "private",
    optin: "single",
  });
  return !!(res && res.statusCode >= 200 && res.statusCode < 300);
}

// Look up a subscriber by exact email. Returns the subscriber object
// ({ id, email, name, lists: [{ id, ... }] }) or null.
function listmonkFindSubscriber(email) {
  // listmonk's `query` is a raw SQL expression on the subscribers table.
  const q = "subscribers.email = '" + String(email).replace(/'/g, "''") + "'";
  const res = listmonkRequest(
    "GET",
    "/api/subscribers?per_page=1&query=" + encodeURIComponent(q),
    null
  );
  if (!res || res.statusCode < 200 || res.statusCode >= 300) return null;
  try {
    const results = res.json.data.results;
    if (results && results.length > 0) return results[0];
  } catch (e) {
    // fall through
  }
  return null;
}

// Ensure an event has an associated listmonk list, creating + persisting it on
// the event record if missing. Idempotent and best-effort: returns the numeric
// list ID, or 0 when listmonk is unavailable / the list could not be created.
function ensureEventListId(app, event) {
  if (!listmonkApiConfigured()) return 0;

  let id = 0;
  try {
    id = event.getInt("listmonk_list_id");
  } catch (e) {
    id = 0;
  }
  if (id && id > 0) return id;

  const created = listmonkCreateList(eventListName(event));
  if (!created.ok) return 0;

  try {
    event.set("listmonk_list_id", created.id);
    app.save(event);
  } catch (saveErr) {
    // The list exists in listmonk even if we couldn't store the ID; return it
    // so the current registration is still assigned. Next time we'd create a
    // duplicate list, so log loudly.
    app.logger().error(
      "failed to persist listmonk_list_id on event",
      "event",
      event.id,
      "error",
      String(saveErr)
    );
  }
  return created.id;
}

// Add an email to the given listmonk list(s), deduped by email. If the
// subscriber already exists with no real name (newsletter sign-ups store the
// email itself as the name), set the provided name. Best-effort; never throws.
// Returns { ok, status: "subscribed" | "exists" | "error" }.
function listmonkAddToLists(email, name, listIds, confirmed) {
  if (!listmonkApiConfigured()) return { ok: false, status: "error" };
  if (!listIds || listIds.length === 0) return { ok: false, status: "error" };

  const cleanName = name && name.trim() ? name.trim() : "";
  const status = confirmed ? "confirmed" : "unconfirmed";

  // 1) Try to create the subscriber with the target lists in one shot.
  const created = listmonkRequest("POST", "/api/subscribers", {
    email: email,
    name: cleanName || email,
    status: "enabled",
    lists: listIds,
    preconfirm_subscriptions: confirmed,
  });
  if (!created) return { ok: false, status: "error" };
  if (created.statusCode >= 200 && created.statusCode < 300) {
    return { ok: true, status: "subscribed" };
  }
  if (created.statusCode !== 409) {
    let detail = "";
    try {
      detail = JSON.stringify(created.json);
    } catch (e) {
      detail = "";
    }
    $app.logger().error("listmonk event subscribe rejected", "email", email, "status", created.statusCode, "body", detail);
    return { ok: false, status: "error" };
  }

  // 2) Already a subscriber (409) — fetch it for the ID + current lists/name.
  const sub = listmonkFindSubscriber(email);
  if (!sub || !sub.id) {
    return { ok: false, status: "error" };
  }

  // 3) Add the event list(s) additively. Safe: never touches other lists.
  listmonkRequest("PUT", "/api/subscribers/lists", {
    ids: [sub.id],
    action: "add",
    target_list_ids: listIds,
    status: status,
  });

  // 4) Set the name only when it's missing (empty or still the email
  //    placeholder a no-name newsletter sign-up leaves behind).
  const subName = (sub.name || "").trim();
  const nameMissing =
    subName === "" || subName.toLowerCase() === String(email).toLowerCase();
  if (cleanName && nameMissing) {
    const union = [];
    try {
      (sub.lists || []).forEach(function (l) {
        if (l && l.id && union.indexOf(l.id) === -1) union.push(l.id);
      });
    } catch (e) {
      // ignore — fall back to just the target lists below
    }
    listIds.forEach(function (lid) {
      if (union.indexOf(lid) === -1) union.push(lid);
    });
    // preconfirm:false → does NOT change existing lists' confirmation status.
    listmonkRequest("PUT", "/api/subscribers/" + sub.id, {
      email: sub.email || email,
      name: cleanName,
      status: sub.status || "enabled",
      lists: union,
      preconfirm_subscriptions: false,
    });
  }

  return { ok: true, status: "exists" };
}

// Remove an email from a single listmonk list (used on cancellation so the
// per-event list mirrors only the current participants). Best-effort.
function listmonkRemoveFromList(email, listId) {
  if (!listmonkApiConfigured() || !listId) return false;
  const sub = listmonkFindSubscriber(email);
  if (!sub || !sub.id) return false;
  const res = listmonkRequest("PUT", "/api/subscribers/lists", {
    ids: [sub.id],
    action: "remove",
    target_list_ids: [listId],
  });
  return !!(res && res.statusCode >= 200 && res.statusCode < 300);
}

module.exports = {
  listmonkConfigured,
  subscribeToListmonk,
  // per-event lists
  listmonkApiConfigured,
  eventListName,
  listmonkCreateList,
  listmonkRenameList,
  listmonkFindSubscriber,
  ensureEventListId,
  listmonkAddToLists,
  listmonkRemoveFromList,
};
