// Emails the owner when someone signs up. Uses the Workers send_email binding (env.EMAIL).
// The recipient comes from the NOTIFY_TO var in wrangler.jsonc (the owner's verified inbox); it must be a verified Email Routing destination.
// Failure here must never block a signup, so callers treat this as best effort.

const FROM = "signups@jubilab.io";
const clean = (v) => String(v ?? "").replace(/[\r\n]+/g, " ").trim();

export function buildRaw(record, to, from = FROM, now = new Date(), id = crypto.randomUUID()) {
  const lines = [
    "A new early-access request arrived on jubilab.io.",
    "",
    "Email: " + clean(record.email),
    "Role: " + (clean(record.role) || "-") + (record.role_other ? " (" + clean(record.role_other) + ")" : ""),
    "Field: " + (clean(record.field) || "-") + (record.field_other ? " (" + clean(record.field_other) + ")" : ""),
    "Runs on: " + ((record.runs_on || []).map(clean).join(", ") || "-") + (record.runs_on_other ? " (other: " + clean(record.runs_on_other) + ")" : ""),
    "Human data: " + (clean(record.human_data) || "-"),
    "Received: " + clean(record.received_at),
    "",
    "How they keep track of how a result was made today:",
    String(record.tracking || "-").replace(/\r/g, "").replace(/\n/g, "\r\n"),
    "",
    "Stored in Cloudflare KV (namespace WAITLIST), key email:" + clean(record.email),
  ];
  return [
    "From: Jubilab signups <" + from + ">",
    "To: " + clean(to),
    "Subject: New early-access request",
    "Date: " + now.toUTCString(),
    "Message-ID: <" + id + "@jubilab.io>",
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    lines.join("\r\n"),
  ].join("\r\n");
}

// EmailMessage is injected because it only exists inside the Workers runtime ("cloudflare:email").
export function makeNotifier(EmailMessage) {
  return async function notify(record, env) {
    if (!env.EMAIL || !env.NOTIFY_TO) return false;
    const to = clean(env.NOTIFY_TO);
    await env.EMAIL.send(new EmailMessage(FROM, to, buildRaw(record, to)));
    return true;
  };
}
