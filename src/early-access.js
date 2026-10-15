// POST /api/early-access, called from src/worker.js.
// Stores one record per email in the KV namespace bound as WAITLIST (see wrangler.jsonc).
// Stores only the form fields (email, role, role_other, field, field_other, runs_on, runs_on_other, human_data, tracking)
// and a UTC timestamp. Everything except the free-text comment (tracking) is required; the "other" text is required
// only when "other" is chosen. Old field names (tools, trace) are ignored, not stored. No IP address or user agent is stored.

const ROLE = ["lab-head", "postdoc-scientist", "grad-student", "bioinformatician-analyst", "core-rse", "other"];
const FIELD = ["genetics-genomics", "bioinformatics-comp-bio", "molecular-cell-biology", "other-life-science", "other-lab-science", "other"];
const RUNS_ON = ["windows", "macos", "linux", "hpc-cluster", "aws", "azure", "gcp", "other"];
const HUMAN = ["yes", "no"];

// Strict address check. Unicode letters are allowed; whitespace, control characters and % < > , ; quotes
// and backslash are not. One "@", local part up to 64, whole address up to 254, domain with a dot and
// non-empty labels that do not start or end with a hyphen.
const BAD_CHARS = /[\s\p{Cc}%<>,;"'`\\]/u;
export function validEmail(e) {
  if (typeof e !== "string" || e.length > 254 || e.includes("\uFFFD") || BAD_CHARS.test(e)) return false;
  const parts = e.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || local.length > 64) return false;
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  return labels.every((l) => l && !l.startsWith("-") && !l.endsWith("-"));
}

const one = (v, allowed) => (typeof v === "string" && allowed.includes(v) ? v : null);

// Free text: control characters and runs of whitespace become one space; trimmed; capped. Returns null when
// the bytes were not valid UTF-8 (U+FFFD) so the caller can reject it.
const text = (v, max) => {
  const s = String(v || "");
  if (s.includes("\uFFFD")) return null;
  return s.replace(/[\p{Cc}\s]+/gu, " ").trim().slice(0, max);
};

// Required "other" text, only when the choice is "other". Returns {value} or {error}.
function other(form, name, chosen) {
  if (!chosen) return { value: null };
  const v = text(form.get(name), 100);
  return v ? { value: v } : { error: name };
}

// Optional comment: invalid UTF-8 returns null (rejected); control characters other than newline are dropped,
// CRLF becomes LF, capped at 300 characters.
const comment = (v) => {
  const s = String(v || "");
  if (s.includes("\uFFFD")) return null;
  return [...s.replace(/\r\n?/g, "\n").replace(/[^\P{Cc}\n]/gu, "").trim()].slice(0, 300).join("").trim();
};

export function parse(form) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (!validEmail(email)) return { error: "email" };
  const role = one(form.get("role"), ROLE);
  if (!role) return { error: "role" };
  const roleOther = other(form, "role-other", role === "other");
  if (roleOther.error) return { error: roleOther.error };
  const field = one(form.get("field"), FIELD);
  if (!field) return { error: "field" };
  const fieldOther = other(form, "field-other", field === "other");
  if (fieldOther.error) return { error: fieldOther.error };
  const picked = form.getAll("runs-on");
  if (!picked.length || picked.some((t) => !RUNS_ON.includes(t))) return { error: "runs-on" };
  const runsOn = [...new Set(picked)];
  const runsOther = other(form, "runs-on-other", runsOn.includes("other"));
  if (runsOther.error) return { error: runsOther.error };
  const human = one(form.get("human-data"), HUMAN);
  if (!human) return { error: "human-data" };
  const tracking = comment(form.get("tracking"));
  if (tracking === null) return { error: "tracking" };
  return {
    record: {
      email,
      role,
      role_other: roleOther.value,
      field,
      field_other: fieldOther.value,
      runs_on: runsOn,
      runs_on_other: runsOther.value,
      human_data: human,
      tracking,
      received_at: new Date().toISOString(),
    },
  };
}

const MAX_BODY = 8192;
export const HONEYPOT = "q7_note";

// Reads the real body, stopping once it exceeds max bytes. Returns null when too large.
async function readCapped(request, max) {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel().catch(() => {}); return null; }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.byteLength; }
  return out;
}

const SORRY = "We could not send your request. Please go back and try again, or email hello@jubilab.io.";
const sorry = (status) => new Response(SORRY, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

const back = (url, q) => Response.redirect(new URL(q, url).toString(), 303);

export async function onRequestPost({ request, env, ctx, notify }) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  // Absent Origin: allowed. Same origin: allowed. The string "null" (no-referrer policy, privacy extensions,
  // some redirects): allowed only when the browser says Sec-Fetch-Site: same-origin, which pages cannot forge.
  const sameSite = request.headers.get("sec-fetch-site") === "same-origin";
  if (origin && origin !== url.origin && !(origin === "null" && sameSite)) {
    console.warn("origin rejected", { origin: origin.slice(0, 200) });
    return sorry(403);
  }
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/x-www-form-urlencoded") && !type.includes("multipart/form-data")) {
    return sorry(415);
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) {
    return sorry(413);
  }
  let form;
  try {
    const bytes = await readCapped(request, MAX_BODY);
    if (!bytes) return sorry(413);
    form = await new Response(bytes, { headers: { "content-type": type } }).formData();
  } catch {
    return sorry(400);
  }
  // Honeypot: real visitors never see or fill the hidden field (HONEYPOT). Pretend success to bots: same 303,
  // nothing stored, nothing sent. The warning carries no personal data so the owner can spot false trips in logs.
  // The OLD field name "website" (pre-rename pages still cached in a browser) is NOT a honeypot: browsers
  // autofill it, so treating it as one would silently drop a real person. It is ignored like any unknown field.
  if (String(form.get(HONEYPOT) || "") !== "") {
    console.warn("honeypot tripped", { field: HONEYPOT, length: String(form.get(HONEYPOT)).length });
    return back(url, "/thanks/");
  }
  const parsed = parse(form);
  if (parsed.error) return back(url, "/?error=" + parsed.error + "#access");
  if (!env.WAITLIST) {
    console.error("WAITLIST binding missing: signup not stored");
    return sorry(503);
  }
  // Keep the FIRST record for an address: never overwrite, never notify twice. The visitor gets the same
  // redirect either way, so nobody can probe whether an address is already on the list. KV is not
  // transactional, so two simultaneous first submissions could both pass this check; that race is accepted.
  const key = "email:" + parsed.record.email;
  if ((await env.WAITLIST.get(key)) !== null) {
    console.warn("duplicate signup ignored");
    return back(url, "/thanks/");
  }
  await env.WAITLIST.put(key, JSON.stringify(parsed.record));
  if (notify) {
    // Best effort: a failed notification must never fail the signup.
    const job = Promise.resolve().then(() => notify(parsed.record, env)).catch((e) => console.error("notify failed:", e && e.message));
    if (ctx && ctx.waitUntil) ctx.waitUntil(job);
  }
  return back(url, "/thanks/");
}
