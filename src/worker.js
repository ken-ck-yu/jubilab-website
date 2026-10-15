// Cloudflare Worker entry. Static files are served by the assets binding; only /api/* reaches this code.
import { onRequestPost } from "./early-access.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/early-access") {
      if (request.method === "POST") return onRequestPost({ request, env });
      return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
    }
    return env.ASSETS.fetch(request);
  },
};
