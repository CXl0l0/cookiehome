// Basic interface. Week 7 uses buttons to create intents; Week 8 swaps them for chat + AI.
import { createGame, currentScenario } from "../engine/model.js";
import { enterHome, applyIntent, isHomeDone } from "../engine/rules.js";
import { scenarios } from "../data/scenarios.js";

let game = enterHome(createGame(scenarios), 0);
let chatHistory = [];
let busy = false;
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

function guestCard(guest, status) {
  const card = el("div", `guest ${status}`);
  card.append(el("strong", "", guest.name), el("span", "tag", guest.party === "first" ? "homeowner" : "outside party"));
  card.append(el("p", "", guest.request));
  if (status !== "pending") {
    card.append(el("em", "", status === "inside" ? "Inside the house" : "Outside"));
  }
  return card;
}

function addMessage(role, content) {
  const bubble = el("p", `message ${role}`, content);
  $("chat-messages").append(bubble);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
  return bubble;
}

async function sendMessage(event) {
  event.preventDefault();
  if (busy) return;
  const input = $("chat-input");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  addMessage("user", message);
  const pendingReply = addMessage("assistant", "Thinking…");
  pendingReply.classList.add("thinking");
  pendingReply.setAttribute("aria-label", "Waiting for the AI response");
  busy = true;
  $("send").disabled = true;
  $("notice").textContent = "";
  const s = currentScenario(game);
  const home = game.homes[s.id];
  const pending = s.guests.filter((g) => home.guests[g.id] === "pending");
  try {
    const response = await fetch("/api/chat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: chatHistory,
        context: { home: s.name, pending: pending.map((g) => ({ category: g.category, request: g.request })) },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not reach the guide.");
    chatHistory.push({ role: "user", content: message }, { role: "assistant", content: result.reply });
    chatHistory = chatHistory.slice(-12);
    pendingReply.textContent = result.reply;
    pendingReply.classList.remove("thinking");
    pendingReply.removeAttribute("aria-label");
    for (const intent of result.decisions) {
      const outcome = applyIntent(game, intent);
      if (outcome.ok) game = outcome.state;
      else $("notice").textContent = outcome.error;
    }
    render();
  } catch (error) {
    // Keep the failed user turn in the conversation so a retry has context.
    pendingReply.textContent = error.message;
    pendingReply.classList.remove("thinking");
  } finally {
    busy = false;
    $("send").disabled = false;
    input.focus();
  }
}

function render() {
  const s = currentScenario(game);
  const home = game.homes[s.id];
  $("home-name").textContent = s.name;
  $("owner").textContent = s.owner;

  const zones = { inside: $("inside"), left: $("outside"), pending: $("waiting") };
  const titles = { inside: "Inside", left: "Outside", pending: "At the door" };
  for (const [k, n] of Object.entries(zones)) { n.textContent = ""; n.append(el("h3", "", titles[k])); }
  for (const g of s.guests) {
    const status = home.guests[g.id];
    zones[status].append(guestCard(g, status));
  }
  for (const [k, n] of Object.entries(zones)) n.hidden = n.children.length === 1;

  const nav = $("nav"); nav.textContent = "";
  game.scenarios.forEach((sc, i) => {
    const b = el("button", i === game.currentHome ? "tab active" : "tab", sc.name);
    b.onclick = () => { game = enterHome(game, i); chatHistory = []; $("chat-messages").replaceChildren(); addMessage("assistant", `Welcome to ${sc.name}. Tell me which requests you’re comfortable with.`); render(); };
    nav.append(b);
  });

  $("done").hidden = !isHomeDone(game);
  const prefs = Object.entries(game.standingPreferences);
  $("prefs").textContent = prefs.length ? prefs.map(([c, d]) => `${c}: ${d}`).join(" | ") : "None saved yet";
  $("log").replaceChildren(...game.log.slice().reverse().map((t) => el("li", "", t)));
}

$("chat-form").addEventListener("submit", sendMessage);
addMessage("assistant", "Hi! Tell me what you’re comfortable sharing, and I’ll update the guests in this home.");
render();
