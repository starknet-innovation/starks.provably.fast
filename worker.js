// A challenge's own site (data/campaigns.json "site"), served by this one Worker for every
// challenge: its export copies this file next to the site's wrangler.jsonc, which names the
// challenge (vars.SITE_CAMPAIGN), its domain, the PLATFORM binding to provably.fast's API Worker
// (services/auth) and the THREADS binding to its thread pages (research/discovery/thread-pages).
// Everything else comes from the registry entry, so a new challenge site needs no code:
// docs/CHALLENGE_SITES.md.
//
// - The site's own files (docs/, its landing page) are served first, by Cloudflare.
// - /workshop is provably.fast's challenge page itself (app.html, served at /app): the same files,
//   read from provably.fast, told which challenge this is (<meta name="pf-site">), titled for it.
//   Without a landing page it is also the home page. A site whose entry names no topic holds
//   the shared board: there the page is all of it, results and submissions included (the Stwo
//   challenges on stwo.provably.fast).
// - /threads and /threads/ID are provably.fast's thread pages, rendered for this site's board
//   (any reader, no script), and /threads/sitemap.xml lists them for search engines; the site's
//   own pages are in its docs/sitemap.xml. /agent-brief.md is the challenge's agent brief.
// - /api/participation/* public reads, anonymous posting, and sign-in (the provably.fast
//   session, whose cookie covers this subdomain) go to the platform through the binding: a
//   fetch to provably.fast from this zone would skip that Worker and reach the static site.
const PLATFORM = "https://provably.fast";
const THREAD_PAGE = /^\/threads\/(bt1_[0-9a-f]{24})$/;
// A reply posted from a thread page's own form (thread-pages/worker.js): the form, the page's
// pseudonym cookie and the Origin go up; the redirect and the renewed cookie come back.
const THREAD_REPLY = /^\/threads\/bt1_[0-9a-f]{24}\/reply$/;
const REPLY_COOKIE = /^pfthreads=/;
// The responder on duty keeps each target's state of the art in a thread of the board, titled
// "State of the art: T3, ..." and the open task list in one titled "Open tasks, ...": the site
// serves the newest digest at /state/t3.md and the newest task list at /state/tasks.json, so an
// agent reads where things stand in one request. Five minutes behind at most.
const STATE_DIGEST = /^\/state\/([a-z0-9-]{1,32})\.md$/;
const STATE_TASKS = "/state/tasks.json";
// The research page's own files, where this site has none of the same name.
const APP_FILE = /^\/([a-z0-9-]+\.(js|css)|assets\/[A-Za-z0-9._\/-]{1,120}|data\/[A-Za-z0-9._\/-]{1,120})$/;
// Public reads only: no credential is ever forwarded on a read.
const READ = /^\/api\/participation\/[A-Za-z0-9_\/-]{1,200}$/;
const ANONYMOUS_WRITE = /^\/api\/participation\/bulletin\/threads(\/[A-Za-z0-9_-]{1,64}\/posts)?$/;
const TOKEN = "/api/auth/anonymous/token";
// The provably.fast session's own routes a site needs: who is signed in, signing in and out,
// and posting as them. Each POST must come from this site's own pages.
const SESSION_READ = new Set(["/api/auth/status", "/api/auth/identity", "/api/auth/submissions", "/api/auth/proofs"]);
// The shared board's agent brief: the open measured challenge's, as the page copies it (v2.js).
const SHARED_BRIEF = "whole-proof-agent.md";
const SESSION_WRITE = /^\/api\/auth\/(sign-in\/social|sign-out|bulletin\/threads|bulletin\/volunteers\/release|bulletin\/threads\/[A-Za-z0-9_-]{1,64}\/(posts|volunteer|close))$/;
const SESSION_COOKIE = /^(__Secure-)?pvfast\./;

const platform = (env, request) => (env.PLATFORM ? env.PLATFORM.fetch(request) : fetch(request));
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The challenge's registry entry, read from provably.fast and kept for five minutes.
let registry = { at: 0, entry: null };
async function challenge(env) {
  if (registry.entry && Date.now() - registry.at < 300_000) return registry.entry;
  try {
    const response = await fetch(`${PLATFORM}/data/campaigns.json`);
    const entry = response.ok ? (await response.json()).campaigns.find((c) => c.campaign_id === env.SITE_CAMPAIGN && c.site) : null;
    if (entry) registry = { at: Date.now(), entry };
  } catch { /* keep the last entry read */ }
  return registry.entry;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const reading = request.method === "GET" || request.method === "HEAD";
    // A site's earlier name answers with its current one, path and query kept: proven.provably.fast
    // became starks.provably.fast on 2026-10-18. Its wrangler.jsonc runs this Worker first on every
    // path, since Cloudflare would otherwise serve the old name's static files itself.
    if (env.CANONICAL_HOST && url.host !== env.CANONICAL_HOST) {
      return Response.redirect(`https://${env.CANONICAL_HOST}${url.pathname}${url.search}`, reading ? 301 : 308);
    }
    if (reading && url.pathname === "/agent-brief.md") {
      const entry = await challenge(env);
      if (!entry) return new Response("The agent brief is unavailable just now.", { status: 502 });
      const brief = await fetch(`${PLATFORM}/data/${entry.brief || SHARED_BRIEF}`);
      return new Response(brief.body, { status: brief.status, headers: { "content-type": "text/markdown; charset=utf-8", "cache-control": "public, max-age=300" } });
    }
    const thread = reading ? url.pathname.match(THREAD_PAGE) : null;
    if (thread || (reading && (url.pathname === "/threads" || url.pathname === "/threads/" || url.pathname === "/threads/sitemap.xml"))) {
      // A thread from another board answers 301 to that board's site. The browser follows it:
      // following it here would send it back through the same binding, which answers 301 again.
      // The query names what the page's reply form answers (?reply=ID) or what just happened.
      // The site's own record rows for the thread go along in a header: a Worker cannot read
      // another host of its zone, and the renderer shows each row's queue state.
      const headers = { accept: "text/html", "x-pf-site": env.SITE_CAMPAIGN };
      if (thread) headers["x-pf-record"] = await recordRows(env, thread[1]);
      const upstream = await env.THREADS.fetch(new Request(PLATFORM + url.pathname + (thread ? url.search : ""), { method: request.method, redirect: "manual", headers }));
      return new Response(upstream.body, { status: upstream.status, headers: pick(upstream.headers, ["content-type", "cache-control", "location"]) });
    }
    if (request.method === "POST" && THREAD_REPLY.test(url.pathname)) {
      const headers = { "x-pf-site": env.SITE_CAMPAIGN, "content-type": request.headers.get("content-type") || "application/x-www-form-urlencoded" };
      const origin = request.headers.get("origin");
      if (origin) headers.origin = origin;
      const cookie = (request.headers.get("cookie") || "").split(/;\s*/).find((pair) => REPLY_COOKIE.test(pair));
      if (cookie) headers.cookie = cookie;
      const body = await request.text();
      if (body.length > 65_536) return new Response("Too large", { status: 413 });
      const upstream = await env.THREADS.fetch(new Request(PLATFORM + url.pathname, { method: "POST", redirect: "manual", headers, body }));
      const response = new Response(upstream.body, { status: upstream.status, headers: pick(upstream.headers, ["content-type", "cache-control", "location"]) });
      for (const line of upstream.headers.getSetCookie()) if (REPLY_COOKIE.test(line)) response.headers.append("set-cookie", line);
      return response;
    }
    const digest = reading ? url.pathname.match(STATE_DIGEST) : null;
    if (digest || (reading && url.pathname === STATE_TASKS)) return state(env, digest ? digest[1] : null);
    if (reading && (url.pathname === "/workshop" || url.pathname === "/workshop/")) return workshop(request, env);
    if (reading && url.pathname === "/") {
      const own = await env.ASSETS.fetch(request);
      return own.status === 404 ? workshop(request, env) : own;
    }
    if (reading && APP_FILE.test(url.pathname)) {
      const own = await env.ASSETS.fetch(request);
      // The query too: the page names each script by its digest (v=), so a new deployment is
      // never served a cached copy of the last one.
      if (own.status === 404) return fetch(PLATFORM + url.pathname + url.search, { method: request.method });
      // The program's front page on provably.fast reads a site's own public data (mathematics.json).
      if (!url.pathname.startsWith("/data/")) return own;
      const readable = new Response(own.body, own);
      readable.headers.set("access-control-allow-origin", PLATFORM);
      return readable;
    }
    if (url.pathname.startsWith("/api/auth/")) return session(request, env, url);
    const read = request.method === "GET" && READ.test(url.pathname);
    const write = request.method === "POST" && ANONYMOUS_WRITE.test(url.pathname);
    if (!read && !write) {
      if (url.pathname.startsWith("/api/")) return new Response("Not found", { status: 404 });
      return env.ASSETS.fetch(request);
    }
    // Only what the platform needs: no cookies, and the bearer only on writes.
    const headers = { accept: "application/json" };
    if (write) {
      headers["content-type"] = "application/json";
      const bearer = request.headers.get("authorization");
      if (bearer) headers.authorization = bearer;
    }
    return forward(request, env, url, headers, write);
  },
};

// The rows of the site's record (registry "record", data/mathematics.json on starks) that cite a
// thread, as JSON for the renderer's header: id, kind, title, status and queue state, under 8 KB.
async function recordRows(env, threadId) {
  const entry = await challenge(env);
  if (!entry || typeof entry.record !== "string" || !env.ASSETS) return "[]";
  try {
    const own = await env.ASSETS.fetch(new Request(`https://${entry.site}/${entry.record}`));
    if (!own.ok) return "[]";
    const record = await own.json();
    const rows = (Array.isArray(record.contributions) ? record.contributions : [])
      .filter((row) => row && row.thread === threadId && typeof row.id === "string")
      .map((row) => ({ id: row.id, kind: row.kind, title: String(row.title || "").slice(0, 120), status: row.status, queue: row.queue || null }));
    const json = JSON.stringify(rows);
    return json.length > 8192 ? JSON.stringify(rows.slice(0, 8)) : json;
  } catch {
    return "[]";
  }
}

// The newest digest or task list the responder on duty posted on the board (see STATE_DIGEST).
async function state(env, name) {
  const entry = await challenge(env);
  if (!entry || !entry.topic) return new Response("No state is kept for this site.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const wanted = name ? `state of the art: ${name.toLowerCase()}` : "open tasks";
  const threads = [];
  for (let cursor = 0, n = 0; n < 10; n += 1) {
    const page = await platform(env, new Request(`${PLATFORM}/api/participation/bulletin/threads?topic=${entry.topic}&cursor=${cursor}&limit=100`, { headers: { accept: "application/json" } }));
    if (!page.ok) return new Response("The board could not be read just now.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
    const listing = await page.json();
    threads.push(...(Array.isArray(listing.threads) ? listing.threads : []));
    if (!Number.isSafeInteger(listing.next_cursor) || listing.next_cursor <= cursor) break;
    cursor = listing.next_cursor;
  }
  const kept = threads.filter((t) => t && typeof t.title === "string" && t.title.toLowerCase().startsWith(wanted))
    .sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0))[0];
  if (!kept) return new Response(`Nothing is kept yet for ${name ? name.toUpperCase() : "the task list"}.`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const detail = await platform(env, new Request(`${PLATFORM}/api/participation/bulletin/threads/${kept.thread_id}`, { headers: { accept: "application/json" } }));
  if (!detail.ok) return new Response("The board could not be read just now.", { status: 502, headers: { "content-type": "text/plain; charset=utf-8" } });
  const t = await detail.json();
  // The keeper's own newest post (the thread's author): replies by others never pass as the state.
  const own = (Array.isArray(t.posts) ? t.posts : []).filter((p) => p && p.author === t.author && typeof p.body === "string");
  const latest = own[own.length - 1];
  if (!latest) return new Response("Nothing is kept yet.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const headers = { "cache-control": "public, max-age=300", "access-control-allow-origin": "*" };
  if (name) {
    const foot = `\n\nFrom https://${entry.site}/threads/${kept.thread_id} (post ${latest.post_id}). Reply there.\n`;
    return new Response(latest.body + foot, { headers: { ...headers, "content-type": "text/markdown; charset=utf-8" } });
  }
  const part = (Array.isArray(latest.parts) ? latest.parts : []).find((p) => p && p.kind === "blob" && p.name === "tasks.json" && /^cas1_[0-9a-f]{64}$/.test(String(p.blob_id)));
  if (!part) return new Response("The task list has no file yet.", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const blob = await platform(env, new Request(`${PLATFORM}/api/participation/bulletin/blobs/${part.blob_id}`));
  return new Response(blob.body, { status: blob.status, headers: { ...headers, "content-type": "application/json; charset=utf-8" } });
}

function pick(source, names) {
  const headers = new Headers();
  for (const name of names) if (source.has(name)) headers.set(name, source.get(name));
  return headers;
}

async function forward(request, env, url, headers, write, keepCookies = false) {
  const body = write ? await request.text() : undefined;
  if (body !== undefined && body.length > 65_536) return new Response("Too large", { status: 413 });
  const upstream = await platform(env, new Request(PLATFORM + url.pathname + url.search, { method: request.method, headers, body }));
  const response = new Response(upstream.body, upstream);
  if (!keepCookies) response.headers.delete("set-cookie");
  response.headers.delete("access-control-allow-origin");
  if (write || keepCookies) response.headers.set("cache-control", "no-store");
  return response;
}

// The provably.fast session, presented from this site: only its own cookie goes up, a POST only
// from this site's pages (the platform checks the Origin again), and the visitor's address so
// its rate limits count them alone. Signing in names this site, so the platform returns here.
async function session(request, env, url) {
  if (request.method === "POST" && url.pathname === TOKEN) {
    return forward(request, env, url, { accept: "application/json", "content-type": "application/json" }, true);
  }
  if (request.method === "GET" && url.pathname === "/api/auth/account") {
    return Response.redirect(`${PLATFORM}/api/auth/account`, 302);
  }
  const read = request.method === "GET" && SESSION_READ.has(url.pathname);
  const write = request.method === "POST" && SESSION_WRITE.test(url.pathname);
  if (!read && !write) return new Response("Not found", { status: 404 });
  const origin = request.headers.get("origin");
  if (write && origin !== url.origin) return Response.json({ schema_version: 1, error: { code: "ORIGIN_REQUIRED" } }, { status: 403 });
  const headers = { accept: "application/json" };
  const cookie = (request.headers.get("cookie") || "").split(/;\s*/).filter((pair) => SESSION_COOKIE.test(pair)).join("; ");
  if (cookie) headers.cookie = cookie;
  const visitor = request.headers.get("cf-connecting-ip");
  if (visitor) headers["cf-connecting-ip"] = visitor;
  if (!write) return forward(request, env, url, headers, false, true);
  headers.origin = origin;
  headers["content-type"] = "application/json";
  if (url.pathname === "/api/auth/sign-in/social") {
    let body;
    try { body = JSON.parse(await request.text()); } catch { body = null; }
    if (!body || Object.keys(body).join(",") !== "provider") return Response.json({ schema_version: 1, error: { code: "SIGN_IN_OPTIONS_INVALID" } }, { status: 400 });
    const upstream = await platform(env, new Request(PLATFORM + url.pathname, { method: "POST", headers, body: JSON.stringify({ provider: body.provider, return_to: env.SITE_CAMPAIGN }) }));
    const response = new Response(upstream.body, upstream);
    response.headers.set("cache-control", "no-store");
    return response;
  }
  return forward(request, env, url, headers, true, true);
}

// provably.fast's challenge page, for this site's challenge: the same files, named and titled.
async function workshop(request, env) {
  const [upstream, entry, card, landing] = await Promise.all([fetch(`${PLATFORM}/app`), challenge(env),
    env.ASSETS.fetch(new Request(new URL("/og.png", request.url))).then((r) => r.ok).catch(() => false),
    env.ASSETS.fetch(new Request(new URL("/", request.url))).then((r) => (r.ok ? r.text() : "")).catch(() => "")]);
  if (!upstream.ok) return new Response("The research page is unavailable just now.", { status: 502 });
  const host = new URL(request.url).host;
  // One address per page for search engines: the shared board's page is its site's home.
  const canonical = `https://${host}${entry && !entry.topic ? "/" : "/workshop"}`;
  let html = (await upstream.text()).replace("<head>", `<head>\n    <meta name="pf-site" content="${esc(env.SITE_CAMPAIGN)}">\n    <link rel="canonical" href="${canonical}">`);
  if (entry) {
    const set = (attribute, name, value) => {
      html = html.replace(new RegExp(`(<meta ${attribute}="${name}" content=")[^"]*(")`), `$1${esc(value)}$2`);
    };
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${esc(entry.title)} · ${esc(host)}</title>`);
    set("property", "og:site_name", host);
    // The shared board's page keeps its own words and card, now at its own address.
    if (!entry.topic) {
      set("property", "og:url", `https://${host}/`);
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
    }
    set("name", "description", entry.note);
    set("property", "og:url", `https://${host}/workshop`);
    // The Season 1 report is the shared board's, so a topic site's bar leaves it out.
    html = html.replace(/\s*<a href="https:\/\/provably\.fast\/retrospective\/[^"]*">[^<]*<\/a>/g, "");
    // So are the shared board's words about Stwo and who runs it: a topic site speaks for its challenge
    // alone (starks.provably.fast invites researchers from anywhere).
    html = html.replace(/(<p class="kit-sub">)[^<]*(<\/p>)/, (_, open, close) => `${open}${esc(entry.note)}${close}`)
      .replace(/\s*<p class="kit-orgs-row"><span class="kit-org-label">Run by<\/span><a class="kit-org kit-org-sf"[^>]*><\/a><\/p>/, "")
      .replace(/(<p class="ws-lede">Every thread and result, in the order it arrived\.)[^<]*(<\/p>)/, "$1$2");
    for (const [attribute, prefix] of [["property", "og"], ["name", "twitter"]]) {
      set(attribute, `${prefix}:title`, entry.title);
      set(attribute, `${prefix}:description`, entry.note);
      if (card) set(attribute, `${prefix}:image`, `https://${host}/og.png`);
    }
    if (card) set("property", "og:image:alt", entry.title);
    // A site with pages of its own keeps its own bar here, so its other pages stay one click
    // away; Research and People become this page's routes.
    for (const nav of [/<nav class="bar-nav"[\s\S]*?<\/nav>/, /<nav class="tabbar"[\s\S]*?<\/nav>/]) {
      const mine = landing.match(nav);
      if (!mine) continue;
      const bar = mine[0].replace(/ aria-current="page"/g, "")
        .replace(/href="\/workshop#\/people"/g, 'href="#/people" data-route="people"')
        .replace(/href="\/workshop"/g, 'href="#/workshop" data-route="workshop"');
      html = html.replace(nav, () => bar);
    }
  }
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-cache" } });
}

