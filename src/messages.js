// Error messages for the form, shown after the Worker redirects to /?error=<code>#access.
// assets/theme.js carries a copy for the in-browser version; a test keeps the two identical.
export const MESSAGES = {
  email: "That email address does not look right. Please check it and send the form again.",
  role: "Please choose your role.",
  "role-other": "You chose Other for your role but did not say what it is. Please choose your role again and type your answer.",
  field: "Please choose your field.",
  "field-other": "You chose Other for your field but did not say what it is. Please choose your field again and type your answer.",
  "runs-on": "Please choose at least one place where your analysis runs.",
  "runs-on-other": "You chose Other for where your analysis runs but did not say what it is. Please choose again and type your answer.",
  "human-data": "Please say whether your work involves human or patient-derived data.",
  tracking: "Your comment could not be read. Please remove unusual characters and try again.",
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const BOX = /(<p class="form-error" id="form-error"[^>]*?)\s+hidden(>)[^<]*(<\/p>)/;

// For /?error=<code> responses: returns the page HTML with the error box visible and carrying the message,
// so the message shows without JavaScript. Unknown codes (or a page without the box) return html unchanged.
export function withError(html, code) {
  if (!Object.prototype.hasOwnProperty.call(MESSAGES, code)) return html;
  return html.replace(BOX, (_m, open, gt, close) => open + gt + esc(MESSAGES[code]) + close);
}

// Static files via the assets binding; /?error=<code> on the home page gets the visible message.
export async function serveAsset(request, env) {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(request);
  const code = url.searchParams.get("error");
  if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html") && code !== null && Object.hasOwn(MESSAGES, code) && res.ok) {
    const headers = new Headers(res.headers);
    for (const h of ["content-length", "content-encoding", "etag"]) headers.delete(h);
    headers.set("cache-control", "no-store");
    return new Response(withError(await res.text(), code), { status: res.status, headers });
  }
  return res;
}
