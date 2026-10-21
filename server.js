// Static file server plus private Gemini and Cookiebot API proxies. API keys stay on the server.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, DECISIONS, SCOPES } from "./src/engine/model.js";
import { buildGuestsFromCookiebotInputs } from "./src/engine/cookiebot-adapter.js";

const root = join(fileURLToPath(import.meta.url), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const AI_CATEGORIES = [...CATEGORIES, "unclassified"];
const inputScenarios = new Map();
const cookieDetailsCache = new Map();
const SCENARIO_TTL_MS = 5 * 60 * 1000;
const DETAILS_CACHE_TTL_MS = 10 * 60 * 1000;

// Load local secrets from .env so they do not need to be entered in every shell.
// Values already supplied by the process environment take precedence.
try {
  const envText = await readFile(join(root, ".env"), "utf8");
  for (const line of envText.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
      if (match[2].startsWith('"')) value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    process.env[match[1]] = value;
  }
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const intentSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    needsClarification: { type: "boolean" },
    followUpTitle: { type: "string" },
    followUpScene: { type: "string" },
    decisions: { type: "array", items: {
      type: "object",
      properties: {
        category: { type: "string", enum: AI_CATEGORIES },
        decision: { type: "string", enum: DECISIONS },
        scope: { type: "string", enum: SCOPES },
        guestIds: { type: "array", items: { type: "string" } },
      }, required: ["category", "decision", "scope", "guestIds"],
    } },
  }, required: ["reply", "needsClarification", "followUpTitle", "followUpScene", "decisions"],
};

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_000) throw new Error("Message is too large.");
  }
  return JSON.parse(raw);
}

function json(res, status, value) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(value));
}

function setInputCors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1):3000$/.test(origin);
  const extensionOrigin = /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
  if (!localOrigin && !extensionOrigin) return false;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

function normalizeDomain(value) {
  const domain = String(value ?? "").trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  if (domain.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain)) return null;
  return domain;
}

const COOKIEBOT_COOKIE_FIELDS = [
  "Name", "Provider", "Path", "HTTPOnly", "Secure", "ThirdParty", "Persistent",
  "ExpireSeconds", "ExpireDays", "ExpireDescription", "TrackerTypeName", "Category",
  "PurposeDescription", "Domain", "Host",
];

function sanitizeCookiebotDetails(details, domain, culture) {
  if (!details || typeof details !== "object" || !Array.isArray(details.cookies)) {
    const fields = details && typeof details === "object" ? Object.keys(details).slice(0, 8).join(", ") : typeof details;
    const received = fields ? ` Fields received: ${fields}.` : "";
    throw new TypeError(`Cookiebot response for ${domain} did not contain cookies[].${received} Check that the API key and domain-group serial are correct, and that this domain is registered in that Cookiebot domain group.`);
  }
  return {
    domain: String(details.domain || domain).slice(0, 253),
    culture: String(details.culture || culture).slice(0, 12),
    cookies: details.cookies.slice(0, 2000).map((row) => Object.fromEntries(
      COOKIEBOT_COOKIE_FIELDS.filter((key) => row?.[key] !== undefined).map((key) => [key, typeof row[key] === "string" ? row[key].slice(0, 2000) : row[key]]),
    )).filter((row) => typeof row.Name === "string" && row.Name.length),
  };
}

function sanitizeChromeCookies(cookies) {
  if (!Array.isArray(cookies)) throw new TypeError("Chrome cookie records must be an array.");
  const allowed = ["name", "domain", "path", "expirationDate", "secure", "httpOnly", "sameSite", "session", "hostOnly", "storeId", "partitionKey"];
  return cookies.slice(0, 2000).map((row) => Object.fromEntries(
    allowed.filter((key) => row?.[key] !== undefined).map((key) => [key, row[key]]),
  ));
}

function sanitizeCookiebotSdk(snapshot) {
  const consent = snapshot?.consent;
  if (!snapshot || typeof snapshot !== "object" || !consent || typeof consent !== "object") throw new TypeError("Cookiebot SDK snapshot must contain consent.");
  return {
    hasResponse: snapshot.hasResponse === true,
    consented: snapshot.consented === true,
    declined: snapshot.declined === true,
    consent: {
      necessary: consent.necessary === true,
      preferences: typeof consent.preferences === "boolean" ? consent.preferences : undefined,
      statistics: typeof consent.statistics === "boolean" ? consent.statistics : undefined,
      marketing: typeof consent.marketing === "boolean" ? consent.marketing : undefined,
      method: ["explicit", "implied"].includes(consent.method || snapshot.method) ? (consent.method || snapshot.method) : null,
    },
  };
}

async function cookieDetails(domain) {
  const apiKey = process.env.COOKIEBOT_API_KEY;
  const domainGroup = process.env.COOKIEBOT_DOMAIN_GROUP;
  const culture = process.env.COOKIEBOT_CULTURE || "default";
  if (!apiKey || !domainGroup) throw new Error("Configure COOKIEBOT_API_KEY and COOKIEBOT_DOMAIN_GROUP on the server first.");
  const allowedDomains = (process.env.COOKIEBOT_ALLOWED_DOMAINS || "").split(",").map(normalizeDomain).filter(Boolean);
  if (!allowedDomains.length) throw new Error("Set COOKIEBOT_ALLOWED_DOMAINS to the site domains this local connector may query.");
  const exactAllowedDomain = allowedDomains.find((allowed) => domain === allowed);
  const parentAllowedDomain = allowedDomains
    .filter((allowed) => domain.endsWith(`.${allowed}`))
    .sort((left, right) => right.length - left.length)[0];
  const scanDomain = exactAllowedDomain || parentAllowedDomain;
  if (!scanDomain) throw new Error("This domain is not in COOKIEBOT_ALLOWED_DOMAINS.");
  const cached = cookieDetailsCache.get(scanDomain);
  if (cached && cached.expiresAt > Date.now()) return cached.details;
  const endpoint = `https://consent.cookiebot.com/api/v1/${encodeURIComponent(apiKey)}/json/domaingroup/${encodeURIComponent(domainGroup)}/${encodeURIComponent(culture)}/domain/${encodeURIComponent(scanDomain)}/cookies`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Cookiebot API returned HTTP ${response.status}. Check the domain group and account access.`);
  const apiResponse = await response.json();
  if (apiResponse && typeof apiResponse === "object" && Object.hasOwn(apiResponse, "error")) {
    let reason = typeof apiResponse.error === "string" ? apiResponse.error : JSON.stringify(apiResponse.error);
    reason = String(reason || "Unspecified API error").replace(/\s+/g, " ").slice(0, 500);
    for (const secret of [apiKey, encodeURIComponent(apiKey), domainGroup, encodeURIComponent(domainGroup)].filter(Boolean).sort((a, b) => b.length - a.length)) {
      reason = reason.split(secret).join("[redacted]");
    }
    throw new Error(`Cookiebot API error for ${scanDomain}: ${reason}`);
  }
  const details = sanitizeCookiebotDetails(apiResponse, scanDomain, culture);
  cookieDetailsCache.set(scanDomain, { details, expiresAt: Date.now() + DETAILS_CACHE_TTL_MS });
  return details;
}

async function readJsonLimited(req, limit = 2_000_000) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw new Error("Input data is too large.");
  }
  return JSON.parse(raw);
}

function pruneScenarios() {
  const now = Date.now();
  for (const [token, item] of inputScenarios) if (item.expiresAt <= now) inputScenarios.delete(token);
}

async function createInputScenario(req, res) {
  try {
    const body = await readJsonLimited(req);
    const siteDomain = normalizeDomain(body.siteDomain);
    if (!siteDomain) { json(res, 400, { error: "A valid site domain is required." }); return; }
    const chromeCookies = sanitizeChromeCookies(body.chromeCookies);
    const cookiebotSdk = sanitizeCookiebotSdk(body.cookiebotSdk);
    const cookiebotDetails = sanitizeCookiebotDetails(body.cookiebotDetails, siteDomain, process.env.COOKIEBOT_CULTURE || "default");
    buildGuestsFromCookiebotInputs({ chromeCookies, siteDomain, cookiebotDetails, cookiebotSdk });
    pruneScenarios();
    const token = randomBytes(24).toString("base64url");
    inputScenarios.set(token, { expiresAt: Date.now() + SCENARIO_TTL_MS, payload: { siteDomain, chromeCookies, cookiebotSdk, cookiebotDetails } });
    json(res, 201, { token, expiresInSeconds: SCENARIO_TTL_MS / 1000 });
  } catch (error) {
    json(res, 400, { error: error instanceof SyntaxError ? "Request body must be valid JSON." : error.message });
  }
}

async function interpret(req, res) {
  if (!process.env.GEMINI_API_KEY) {
    res.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "AI is not configured yet. Add GEMINI_API_KEY to your environment and restart the server." }));
    return;
  }
  try {
    const body = await readJson(req);
    if (typeof body.message !== "string" || !body.message.trim() || body.message.length > 2000) {
      res.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Enter a message under 2,000 characters." })); return;
    }
    const safeCategories = AI_CATEGORIES;
    const context = {
      home: String(body.context?.home ?? "").slice(0, 100),
      pending: Array.isArray(body.context?.pending) ? body.context.pending.filter((x) => safeCategories.includes(x.category)).map((x) => ({ category: x.category, request: String(x.request).slice(0, 300) })) : [],
      currentGuests: Array.isArray(body.context?.currentGuests) ? body.context.currentGuests.filter((x) => typeof x.id === "string" && typeof x.name === "string" && safeCategories.includes(x.category)).map((x) => ({ id: x.id.slice(0, 100), name: x.name.slice(0, 120), category: x.category, request: String(x.request ?? "").slice(0, 300), status: ["pending", "inside", "left"].includes(x.status) ? x.status : "pending" })) : [],
      conversation: Array.isArray(body.history) ? body.history.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 1000) })) : [],
      activeFollowUp: body.context?.activeFollowUp && typeof body.context.activeFollowUp === "object" ? {
        title: String(body.context.activeFollowUp.title ?? "").slice(0, 120),
        scene: String(body.context.activeFollowUp.scene ?? "").slice(0, 500),
      } : null,
      message: body.message.trim(),
    };
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt = `Interpret the user's latest message in the context below. Only decide when the user clearly expresses accept or reject. Map everyday phrases like remembering settings to functionality and tracking or ads to advertising. Every decision MUST include guestIds from currentGuests, exactly identifying the guest(s) the user referred to. Decisions can change an earlier choice: if the user asks to welcome, allow, let in, or bring back a guest whose status is left, output an accept decision for that exact guest ID. If the user asks to remove, reject, block, or no longer welcome a guest whose status is inside, output a reject decision for that exact guest ID. Apply the same accept/reject interpretation to pending guests. Never substitute another guest/category if the named target is essential or otherwise cannot be changed. Essential guests may be named as targets so the engine can explain they cannot be changed; do not redirect that choice to another guest. Unclassified guests are also present in the current home. If the user explicitly rejects/blocks an unclassified guest, output category unclassified, decision reject, scope this_home, and that exact guest ID. Do not accept an unclassified guest because its purpose is unknown; ask for clarification instead. Scope is all_homes only when the user clearly asks for a lasting general preference; otherwise this_home. Never infer a preference from silence, uncertainty, or an unrelated message. If ambiguous, ask one concise clarifying question, set needsClarification true, return no decisions, and generate a short linked follow-up scenario: its title and a concrete 1-2 sentence scene that asks about the unclear request. The follow-up should clarify the user's intention, not pressure them or invent a new permission request. If the user's message clearly answers only some of the pending guests, set needsClarification false, return only those explicit decisions, and generate a new linked scenario that naturally asks about the remaining unanswered guests. Name only requests from the pending list and do not infer any choice for them. If the clear answer resolves every pending guest, leave followUpTitle and followUpScene empty. If the message is unrelated or gives no clear decision, ask a brief clarifying question and make no changes. A clarification response should answer conversationally and explain each change briefly. Return only decisions supported by the latest message and context.\n\nConversation and current home context:\n${JSON.stringify(context)}`;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST", headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `You are the friendly guide in Cookie Homes, a privacy-preference game. Available decision categories are ${safeCategories.join(", ")}. Help users express their preferences naturally, without requiring cookie terminology.` }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: intentSchema },
      }),
    });
    if (!response.ok) {
      const details = await response.text();
      console.error("Gemini API error:", response.status, details.slice(0, 500));
      let upstreamMessage = "";
      try { upstreamMessage = JSON.parse(details).error?.message ?? ""; } catch { /* keep the user-facing fallback */ }
      let message = "Gemini rejected the request. Check the server terminal for the API error.";
      if (response.status === 400) message = `Gemini rejected the request${upstreamMessage ? `: ${upstreamMessage}` : ". Check the server terminal for details."}`;
      else if (response.status === 401 || response.status === 403) message = "Gemini rejected the API key. Check that GEMINI_API_KEY is valid and has access to the Gemini API.";
      else if (response.status === 429) message = "Gemini's free quota or rate limit was reached. Check your Gemini API usage and limits in Google AI Studio.";
      else if (response.status === 404) message = `Gemini model '${model}' was not found. Check GEMINI_MODEL or use gemini-3.5-flash-lite.`;
      res.writeHead(502, { "Content-Type": "application/json" }).end(JSON.stringify({ error: message })); return;
    }
    const data = await response.json();
    const output = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!output) throw new Error("AI returned no structured result.");
    const result = JSON.parse(output);
    const currentById = new Map(context.currentGuests.map((guest) => [guest.id, guest]));
    const targetedIds = result.decisions.flatMap((decision) => decision.guestIds ?? []);
    if (result.decisions.some((d) => !safeCategories.includes(d.category) || !Array.isArray(d.guestIds) || !d.guestIds.length || new Set(d.guestIds).size !== d.guestIds.length || d.guestIds.some((id) => !currentById.has(id) || currentById.get(id).category !== d.category)) || new Set(targetedIds).size !== targetedIds.length) {
      throw new Error("AI returned invalid decisions.");
    }
    if (result.needsClarification) {
      result.decisions = [];
      result.followUpTitle = String(result.followUpTitle ?? "").slice(0, 120);
      result.followUpScene = String(result.followUpScene ?? "").slice(0, 500);
      if (!result.followUpTitle || !result.followUpScene) throw new Error("AI returned an incomplete follow-up scenario.");
    } else {
      const decidedIds = new Set(targetedIds);
      const remainingCategories = context.currentGuests.filter((guest) => guest.status === "pending" && !decidedIds.has(guest.id)).map((guest) => guest.category);
      if (remainingCategories.length) {
        result.followUpTitle = String(result.followUpTitle ?? "").slice(0, 120);
        result.followUpScene = String(result.followUpScene ?? "").slice(0, 500);
        if (!result.followUpTitle || !result.followUpScene) throw new Error("AI returned an incomplete next scenario for unanswered requests.");
      } else {
        result.followUpTitle = "";
        result.followUpScene = "";
      }
    }
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    console.error("Chat request failed:", error.message);
    const status = error instanceof SyntaxError ? 400 : 500;
    const message = status === 400 ? "The message could not be read." : error.cause ? "Could not connect to the Gemini API. Check your internet connection and try again." : "Something went wrong. Check the server terminal for details.";
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: message }));
  }
}

createServer(async (req, res) => {
  const requestUrl = new URL(req.url, "http://localhost:3000");
  if (["/api/cookiebot/details", "/api/input-scenarios"].includes(requestUrl.pathname) || requestUrl.pathname.startsWith("/api/input-scenarios/")) {
    if (!setInputCors(req, res)) { json(res, 403, { error: "Origin is not allowed." }); return; }
    if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  }
  if (req.method === "GET" && requestUrl.pathname === "/api/cookiebot/details") {
    const domain = normalizeDomain(requestUrl.searchParams.get("domain"));
    if (!domain) { json(res, 400, { error: "Provide a valid domain query parameter." }); return; }
    try { json(res, 200, await cookieDetails(domain)); }
    catch (error) {
      const status = /COOKIEBOT_API_KEY|COOKIEBOT_DOMAIN_GROUP|COOKIEBOT_ALLOWED_DOMAINS/.test(error.message) ? 503 : 502;
      json(res, status, { error: error.message });
    }
    return;
  }
  if (req.method === "POST" && requestUrl.pathname === "/api/input-scenarios") { await createInputScenario(req, res); return; }
  const scenarioMatch = requestUrl.pathname.match(/^\/api\/input-scenarios\/([A-Za-z0-9_-]{32})$/);
  if (req.method === "GET" && scenarioMatch) {
    pruneScenarios();
    const item = inputScenarios.get(scenarioMatch[1]);
    if (!item) { json(res, 404, { error: "This input handoff expired or was already opened. Collect the site again." }); return; }
    inputScenarios.delete(scenarioMatch[1]);
    json(res, 200, item.payload);
    return;
  }
  if (req.method === "POST" && req.url === "/api/chat") { await interpret(req, res); return; }
  if (req.url.startsWith("/api/")) { res.writeHead(404).end("Not found"); return; }
  const path = req.url.split("?")[0];
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "text/plain" }).end(body);
  } catch { res.writeHead(404).end("Not found"); }
}).listen(3000, "localhost", () => console.log("Cookie Homes running at http://localhost:3000"));
