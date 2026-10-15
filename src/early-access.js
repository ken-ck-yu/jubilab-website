// POST /api/early-access, called from src/worker.js.
// Stores one record per email in the KV namespace bound as WAITLIST (see wrangler.jsonc).
// Stores only the form fields (email, role, role_other, field, field_other, runs_on, runs_on_other, human_data, tracking)
// and a UTC timestamp. Everything except the free-text comment (tracking) is required; the "other" text is required
// only when "other" is chosen. Old field names (tools, trace) are ignored, not stored. No IP address or user agent is stored.

const ROLE = ["lab-head", "postdoc-scientist", "grad-student", "bioinformatician-analyst", "core-rse", "other"];
const FIELD = ["genetics-genomics", "bioinformatics-comp-bio", "molecular-cell-biology", "other-life-science", "other-lab-science", "other"];
const RUNS_ON = ["windows", "macos", "linux", "hpc-cluster", "aws", "azure", "gcp", "other"];
const HUMAN = ["yes", "no"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

export function parse(form) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  // U+FFFD means the submitted bytes were not valid UTF-8; real addresses never contain it.
  if (email.length > 254 || email.includes("\uFFFD") || !EMAIL_RE.test(email)) return { error: "email" };
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
      tracking: String(form.get("tracking") || "").trim().slice(0, 300),
      received_at: new Date().toISOString(),
    },
  };
}

const MAX_BODY = 8192;

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

const back = (url, q) => Response.redirect(new URL(q, url).toString(), 303);

export async function onRequestPost({ request, env, ctx, notify }) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/x-www-form-urlencoded") && !type.includes("multipart/form-data")) {
    return new Response("Unsupported media type", { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > MAX_BODY) {
    return new Response("Payload too large", { status: 413 });
  }
  let form;
  try {
    const bytes = await readCapped(request, MAX_BODY);
    if (!bytes) return new Response("Payload too large", { status: 413 });
    form = await new Response(bytes, { headers: { "content-type": type } }).formData();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  // Honeypot: real visitors never see or fill this field. Pretend success to bots.
  if (String(form.get("website") || "") !== "") return back(url, "/thanks/");
  const parsed = parse(form);
  if (parsed.error) return back(url, "/?error=" + parsed.error + "#access");
  if (!env.WAITLIST) return new Response("Service not configured", { status: 503 });
  await env.WAITLIST.put("email:" + parsed.record.email, JSON.stringify(parsed.record));
  if (notify) {
    // Best effort: a failed notification must never fail the signup.
    const job = Promise.resolve().then(() => notify(parsed.record, env)).catch((e) => console.error("notify failed:", e && e.message));
    if (ctx && ctx.waitUntil) ctx.waitUntil(job);
  }
  return back(url, "/thanks/");
}
