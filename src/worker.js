// Cloudflare Worker entry. Static files are served by the assets binding; only /api/* reaches this code.
import { EmailMessage } from "cloudflare:email";
import { onRequestPost } from "./early-access.js";
import { makeNotifier } from "./notify.js";

const notify = makeNotifier(EmailMessage);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/early-access") {
      if (request.method === "POST") return onRequestPost({ request, env, ctx, notify });
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    }
    return env.ASSETS.fetch(request);
  },
};
