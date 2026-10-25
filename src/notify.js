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
    "Org type: " + (clean(record.org_type) || "-"),
    "Providers used: " + (clean(record.providers) || "-"),
    "Monthly samples: " + (clean(record.volume) || "-"),
    "ELN: " + (clean(record.eln) || "-") + (record.eln_other ? " (" + clean(record.eln_other) + ")" : ""),
    "Received: " + clean(record.received_at),
    "",
    "What they most want fixed about how they order lab work:",
    String(record.comment || "-").replace(/\r/g, "").replace(/\n/g, "\r\n"),
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
