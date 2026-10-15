// Cloudflare Pages Function: POST /api/early-access
// Stores one record per email in the KV namespace bound as WAITLIST (set in the Pages dashboard).
// Stores only the form fields and a UTC timestamp. It does not store IP address or user agent.

const ROLE = ["lab-head", "researcher-analyst", "core-platform", "other"];
const FIELD = ["genetics-genomics", "other-life-science", "other-lab-science"];
const TOOLS = ["nextflow", "snakemake", "galaxy", "scripts-notebooks", "other"];
const HUMAN = ["yes", "no", "prefer-not-to-say"];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const one = (v, allowed) => (typeof v === "string" && allowed.includes(v) ? v : null);

export function parse(form) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { error: "email" };
  return {
    record: {
      email,
      role: one(form.get("role"), ROLE),
      field: one(form.get("field"), FIELD),
      tools: form.getAll("tools").filter((t) => TOOLS.includes(t)),
      human_data: one(form.get("human-data"), HUMAN),
      trace: String(form.get("trace") || "").trim().slice(0, 300),
      received_at: new Date().toISOString(),
    },
  };
}

const back = (url, q) => Response.redirect(new URL(q, url).toString(), 303);

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  if (origin && origin !== url.origin) return new Response("Forbidden", { status: 403 });
  const type = request.headers.get("content-type") || "";
  if (!type.includes("application/x-www-form-urlencoded") && !type.includes("multipart/form-data")) {
    return new Response("Unsupported media type", { status: 415 });
  }
  if (Number(request.headers.get("content-length") || 0) > 8192) {
    return new Response("Payload too large", { status: 413 });
  }
  const form = await request.formData();
  // Honeypot: real visitors never see or fill this field. Pretend success to bots.
  if (String(form.get("website") || "") !== "") return back(url, "/thanks/");
  const parsed = parse(form);
  if (parsed.error) return back(url, "/?error=email#access");
  if (!env.WAITLIST) return new Response("Service not configured", { status: 503 });
  await env.WAITLIST.put("email:" + parsed.record.email, JSON.stringify(parsed.record));
  return back(url, "/thanks/");
}

export function onRequest() {
  return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}
