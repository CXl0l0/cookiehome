// Static file server plus the private Gemini API proxy. The API key stays on the server.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { CATEGORIES, DECISIONS, SCOPES } from "./src/engine/model.js";

const root = join(fileURLToPath(import.meta.url), "..");
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const AI_CATEGORIES = CATEGORIES.filter((category) => category !== "essential");

const intentSchema = {
  type: "object",
  properties: {
    reply: { type: "string" },
    needsClarification: { type: "boolean" },
    decisions: { type: "array", items: {
      type: "object",
      properties: {
        category: { type: "string", enum: AI_CATEGORIES },
        decision: { type: "string", enum: DECISIONS },
        scope: { type: "string", enum: SCOPES },
      }, required: ["category", "decision", "scope"],
    } },
  }, required: ["reply", "needsClarification", "decisions"],
};

async function readJson(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 16_000) throw new Error("Message is too large.");
  }
  return JSON.parse(raw);
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
      conversation: Array.isArray(body.history) ? body.history.slice(-8).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 1000) })) : [],
      message: body.message.trim(),
    };
    const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
    const prompt = `Interpret the user's latest message in the context below. Only decide a category when the user clearly expresses accept or reject. Map everyday phrases like remembering settings to functionality and tracking or ads to advertising. Essential cookies are always enabled and never produce a decision. Scope is all_homes only when the user clearly asks for a lasting general preference; otherwise this_home. Never infer a preference from silence, uncertainty, or an unrelated message. If ambiguous, ask one concise clarifying question, set needsClarification true, and return no decisions. A clarification response should answer conversationally and explain each change briefly. Return only decisions supported by the latest message and context.\n\nConversation and current home context:\n${JSON.stringify(context)}`;
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
    if (result.decisions.some((d) => d.category === "essential" || !safeCategories.includes(d.category)) || new Set(result.decisions.map((d) => d.category)).size !== result.decisions.length) {
      throw new Error("AI returned invalid decisions.");
    }
    if (result.needsClarification) result.decisions = [];
    res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    console.error("Chat request failed:", error.message);
    const status = error instanceof SyntaxError ? 400 : 500;
    const message = status === 400 ? "The message could not be read." : error.cause ? "Could not connect to the Gemini API. Check your internet connection and try again." : "Something went wrong. Check the server terminal for details.";
    res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify({ error: message }));
  }
}

createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") { await interpret(req, res); return; }
  if (req.url.startsWith("/api/")) { res.writeHead(404).end("Not found"); return; }
  const path = req.url.split("?")[0];
  const file = normalize(join(root, path === "/" ? "index.html" : path));
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "text/plain" }).end(body);
  } catch { res.writeHead(404).end("Not found"); }
}).listen(3000, () => console.log("Cookie Homes running at http://localhost:3000"));
