// POST /api/early-access, called from src/worker.js.
// Stores one record per email in the KV namespace bound as WAITLIST (see wrangler.jsonc).
// Stores only the form fields (email, role, field, runs_on, human_data, tracking) and a UTC timestamp.
// Old field names (tools, trace) from the previous form are ignored, not stored. It does not store IP address or user agent.

const ROLE = ["lab-head", "researcher-analyst", "core-platform", "other"];
const FIELD = ["genetics-genomics", "other-life-science", "other-lab-science"];
const RUNS_ON = ["laptop-workstation", "hpc-cluster", "cloud", "other"];
const HUMAN = ["yes", "no", "prefer-not-to-say"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const one = (v, allowed) => (typeof v === "string" && allowed.includes(v) ? v : null);

export function parse(form) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  // U+FFFD means the submitted bytes were not valid UTF-8; real addresses never contain it.
  if (email.length > 254 || email.includes("\uFFFD") || !EMAIL_RE.test(email)) return { error: "email" };
  return {
    record: {
      email,
      role: one(form.get("role"), ROLE),
      field: one(form.get("field"), FIELD),
      runs_on: [...new Set(form.getAll("runs-on").filter((t) => RUNS_ON.includes(t)))],
      human_data: one(form.get("human-data"), HUMAN),
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
  if (parsed.error) return back(url, "/?error=email#access");
  if (!env.WAITLIST) return new Response("Service not configured", { status: 503 });
  await env.WAITLIST.put("email:" + parsed.record.email, JSON.stringify(parsed.record));
  if (notify) {
    // Best effort: a failed notification must never fail the signup.
    const job = Promise.resolve().then(() => notify(parsed.record, env)).catch((e) => console.error("notify failed:", e && e.message));
    if (ctx && ctx.waitUntil) ctx.waitUntil(job);
  }
  return back(url, "/thanks/");
}
