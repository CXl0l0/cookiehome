// Chat requests go to the server-side interpreter; deterministic rules apply its structured intents.
import { createGame, currentScenario } from "../engine/model.js";
import { enterHome, applyIntent, isHomeDone } from "../engine/rules.js";
import { scenarios } from "../data/scenarios.js";

let initialScenarios = scenarios;
try {
  const savedRoster = sessionStorage.getItem("cookiehomes.generatedScenario");
  if (savedRoster) {
    const imported = JSON.parse(savedRoster);
    if (imported && Array.isArray(imported.guests) && imported.guests.length) {
      initialScenarios = [{ id: "generated-site", name: imported.name || "Generated test site", owner: "the site owner", story: "This home was built from the cookie metadata and CMP inputs you supplied. Review each guest and its source metadata before making a choice.", guests: imported.guests }];
    }
    sessionStorage.removeItem("cookiehomes.generatedScenario");
  }
} catch { /* fall back to the built-in homes if imported demo data is invalid */ }
let game = enterHome(createGame(initialScenarios), 0);
let chatHistory = [];
let activeFollowUp = null;
let busy = false;
let recentlyChanged = new Set();

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};
const labels = {
  authentication: "Remembering your visit",
  functionality: "Personal settings",
  analytics: "Visit statistics",
  advertising: "Ad tracking",
};
const shortLabels = {
  authentication: "Remember me",
  functionality: "Personal settings",
  analytics: "Visit statistics",
  advertising: "Ad tracking",
};

function addMessage(role, content) {
  const bubble = el("p", `message ${role}`, content);
  $("chat-messages").append(bubble);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
  return bubble;
}

function guestCard(guest, status) {
  const card = el("article", `guest ${status}${guest.party === "third" ? " third-party" : ""}${recentlyChanged.has(guest.id) ? " updated" : ""}`);
  const top = el("div", "guest-top");
  top.append(el("span", "guest-avatar", guest.name.trim().charAt(0).toUpperCase()));
  top.append(el("strong", "guest-name", guest.name));
  const stateLabel = status === "pending" ? "At the door" : status === "inside" ? "Welcomed" : "Outside";
  top.append(el("span", "guest-state", stateLabel));
  card.append(top);
  card.append(el("span", "guest-party", guest.party === "first" ? "THE HOST" : "A THIRD-PARTY GUEST"));
  card.append(el("p", "", guest.request));
  if (guest.metadata) {
    const details = el("details", "guest-metadata");
    details.append(el("summary", "", `Cookie metadata · ${guest.metadata.name}`));
    details.append(el("p", "", `${guest.metadata.domain} · path ${guest.metadata.path} · ${guest.metadata.expires} · Secure ${guest.metadata.secure} · HttpOnly ${guest.metadata.httpOnly} · SameSite ${guest.metadata.sameSite} · ${guest.metadata.party}-party · purpose: ${guest.category} (${guest.purposeEvidence})${guest.cmpDecision ? ` · CMP: ${guest.cmpDecision}` : ""}`));
    card.append(details);
  }
  card.setAttribute("aria-label", `${guest.name}: ${stateLabel}. ${guest.request}`);
  return card;
}

function allOptionalGuests() {
  return game.scenarios.flatMap((scenario) => scenario.guests.filter((guest) => guest.category !== "essential").map((guest) => ({ scenario, guest })));
}

function progressStats() {
  const optional = allOptionalGuests();
  const resolved = optional.filter(({ scenario, guest }) => {
    const status = game.homes[scenario.id].guests[guest.id];
    return status === "inside" || status === "left";
  }).length;
  return { resolved, total: optional.length, percent: optional.length ? Math.round(resolved / optional.length * 100) : 100 };
}

function renderNav() {
  const nav = $("nav");
  nav.replaceChildren();
  game.scenarios.forEach((scenario, index) => {
    const complete = isHomeDone(game, index);
    const button = el("button", `tab${index === game.currentHome ? " active" : ""}${complete ? " complete" : ""}`);
    button.type = "button";
    button.setAttribute("aria-current", index === game.currentHome ? "step" : "false");
    const number = el("span", "step-number", complete ? "✓" : String(index + 1));
    button.append(number, el("span", "", scenario.name));
    button.addEventListener("click", () => selectHome(index));
    nav.append(button);
  });
}

function selectHome(index) {
  if (busy || index === game.currentHome) return;
  game = enterHome(game, index);
  chatHistory = [];
  activeFollowUp = null;
  recentlyChanged = new Set();
  $("follow-up").hidden = true;
  $("chat-messages").replaceChildren();
  const scenario = currentScenario(game);
  addMessage("assistant", `Welcome to ${scenario.name}. You can tell ${scenario.owner} what you’re comfortable with in one note; I’ll help make sure each guest’s request is understood.`);
  render();
  $("chat-input").placeholder = "For example: Remember my settings, but don’t let advertisers follow me.";
  $("chat-input").focus({ preventScroll: true });
}

function outcomePill(name, status) {
  const icon = status === "inside" ? "✓" : status === "left" ? "↗" : "·";
  const label = status === "inside" ? "Welcomed" : status === "left" ? "Outside" : "At the door";
  return el("span", `outcome-pill ${status === "inside" ? "in" : status === "left" ? "out" : "wait"}`, `${icon} ${name} · ${label}`);
}

function renderOutcome(s, home) {
  const summary = $("outcome-summary");
  summary.replaceChildren();
  const finished = s.guests.filter((guest) => guest.category !== "essential").filter((guest) => ["inside", "left"].includes(home.guests[guest.id])).length;
  const optionalTotal = s.guests.filter((guest) => guest.category !== "essential").length;
  $("outcome-count").textContent = `${finished}/${optionalTotal} choices`;
  for (const guest of s.guests) {
    const status = home.guests[guest.id];
    if (status !== "pending") summary.append(outcomePill(guest.name, status));
  }
  if (!summary.children.length) summary.append(el("p", "pref-empty", "Your decisions will show up here as the home takes shape."));
}

function render() {
  const scenario = currentScenario(game);
  const home = game.homes[scenario.id];
  const completed = isHomeDone(game);
  const stats = progressStats();
  const waiting = scenario.guests.filter((guest) => home.guests[guest.id] === "pending");
  const welcomed = scenario.guests.filter((guest) => home.guests[guest.id] === "inside");
  const outside = scenario.guests.filter((guest) => home.guests[guest.id] === "left");

  $("home-name").textContent = scenario.name;
  $("owner").textContent = `Hosted by ${scenario.owner}`;
  $("home-step").textContent = `HOME ${String(game.currentHome + 1).padStart(2, "0")} · ${completed ? "VISIT COMPLETE" : game.currentHome === 0 ? "YOUR FIRST STOP" : "YOUR NEXT STOP"}`;
  $("home-brief").textContent = completed
    ? `${scenario.story} Your choices are reflected below; every guest now has a clear answer.`
    : waiting.length
      ? `${scenario.story} ${waiting.length} ${waiting.length === 1 ? "guest is" : "guests are"} still waiting. You can cover these requests together in one note.`
      : "This home’s requests have been answered. Take a look at the choices you made.";

  const waitingZone = $("waiting");
  waitingZone.replaceChildren(el("h3", "", waiting.length ? `At the door · ${waiting.length}` : "No one waiting"));
  const waitGrid = el("div", "guest-grid");
  waiting.forEach((guest) => waitGrid.append(guestCard(guest, "pending")));
  if (waiting.length) waitingZone.append(waitGrid);

  const insideZone = $("inside");
  insideZone.replaceChildren();
  if (welcomed.length) {
    insideZone.append(el("h3", "", `Welcomed inside · ${welcomed.length}`));
    const grid = el("div", "guest-grid");
    welcomed.forEach((guest) => grid.append(guestCard(guest, "inside")));
    insideZone.append(grid);
  }
  const outsideZone = $("outside");
  outsideZone.replaceChildren();
  if (outside.length) {
    outsideZone.append(el("h3", "", `Staying outside · ${outside.length}`));
    const grid = el("div", "guest-grid");
    outside.forEach((guest) => grid.append(guestCard(guest, "left")));
    outsideZone.append(grid);
  }

  const progress = $("progress-bar");
  progress.setAttribute("aria-valuenow", String(stats.percent));
  $("progress-fill").style.width = `${stats.percent}%`;
  $("progress-percent").textContent = `${stats.percent}%`;
  $("progress-caption").textContent = `Home ${game.currentHome + 1} of ${game.scenarios.length}`;
  $("journey-count").textContent = `${stats.resolved} of ${stats.total} guest choices made`;

  const prefs = Object.entries(game.standingPreferences);
  const prefList = $("prefs");
  prefList.replaceChildren();
  if (!prefs.length) prefList.append(el("p", "pref-empty", "No all-home preferences saved. Each visit can be its own choice."));
  for (const [category, decision] of prefs) {
    const chip = el("div", "pref-chip");
    chip.append(el("span", "", shortLabels[category] ?? category), el("strong", "", decision === "accept" ? "Always allow" : "Always ask / block"));
    prefList.append(chip);
  }

  const completion = $("completion");
  completion.hidden = !completed;
  if (completed) {
    const nextIndex = game.currentHome + 1;
    const hasNext = nextIndex < game.scenarios.length;
    const nextButton = $("next-home");
    nextButton.hidden = !hasNext;
    nextButton.onclick = () => selectHome(nextIndex);
    const allComplete = game.scenarios.every((_, index) => isHomeDone(game, index));
    $("completion-copy").textContent = allComplete
      ? `You welcomed ${welcomed.length} ${welcomed.length === 1 ? "guest" : "guests"} and left ${outside.length} outside in this home. Your journey is complete—your preferences are reflected in the house and summary.`
      : `You welcomed ${welcomed.length} ${welcomed.length === 1 ? "guest" : "guests"} and left ${outside.length} outside. When you’re ready, meet the next host.`;
    if (allComplete) $("journey-count").textContent = "Your privacy journey is complete";
  }
  renderOutcome(scenario, home);
  renderNav();

  if (recentlyChanged.size) {
    const changed = recentlyChanged;
    window.setTimeout(() => {
      if (recentlyChanged === changed) {
        recentlyChanged = new Set();
        renderGuestZonesOnly();
      }
    }, 650);
  }
}

function renderGuestZonesOnly() {
  const scenario = currentScenario(game);
  const home = game.homes[scenario.id];
  for (const [key, status] of [["waiting", "pending"], ["inside", "inside"], ["outside", "left"]]) {
    const zone = $(key);
    const guests = scenario.guests.filter((guest) => home.guests[guest.id] === status);
    if (!guests.length) continue;
    const grid = zone.querySelector(".guest-grid");
    if (!grid) continue;
    grid.replaceChildren(...guests.map((guest) => guestCard(guest, status)));
  }
}

async function sendMessage(event) {
  event.preventDefault();
  if (busy) return;
  const input = $("chat-input");
  const message = input.value.trim();
  if (!message) return;
  input.value = "";
  addMessage("user", message);
  const pendingReply = addMessage("assistant", "Reading your note…");
  pendingReply.classList.add("thinking");
  pendingReply.setAttribute("aria-label", "Waiting for the guide");
  busy = true;
  $("send").disabled = true;
  $("send-label").textContent = "One moment";
  $("notice").textContent = "";

  const scenario = currentScenario(game);
  const home = game.homes[scenario.id];
  const pending = scenario.guests.filter((guest) => home.guests[guest.id] === "pending");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: chatHistory,
        context: {
          home: scenario.name,
          pending: pending.map((guest) => ({ category: guest.category, request: guest.request })),
          currentGuests: scenario.guests.map((guest) => ({ id: guest.id, name: guest.name, category: guest.category, request: guest.request, status: home.guests[guest.id] })),
          activeFollowUp,
        },
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not reach the guide.");

    pendingReply.textContent = result.reply;
    pendingReply.classList.remove("thinking");
    pendingReply.removeAttribute("aria-label");
    chatHistory.push({ role: "user", content: message }, { role: "assistant", content: result.reply });
    chatHistory = chatHistory.slice(-12);

    const before = { ...game.homes[scenario.id].guests };
    if (result.followUpTitle && result.followUpScene) {
      activeFollowUp = { title: result.followUpTitle, scene: result.followUpScene, parent: scenario.name };
      $("follow-up-title").textContent = activeFollowUp.title;
      $("follow-up-scene").textContent = activeFollowUp.scene;
      $("follow-up-parent").textContent = result.needsClarification
        ? `Linked to your conversation at ${scenario.name}. No choice has been applied yet.`
        : `Linked to your conversation at ${scenario.name}. Unanswered requests remain undecided.`;
      $("follow-up").hidden = false;
      $("chat-input").placeholder = `Your reply to “${activeFollowUp.title}”…`;
    } else {
      activeFollowUp = null;
      $("follow-up").hidden = true;
      $("chat-input").placeholder = "For example: Remember my settings, but don’t let advertisers follow me.";
    }

    recentlyChanged = new Set();
    for (const intent of result.decisions) {
      const outcome = applyIntent(game, intent);
      if (outcome.ok) game = outcome.state;
      else $("notice").textContent = outcome.error;
    }
    const after = game.homes[scenario.id].guests;
    const entered = scenario.guests.filter((guest) => before[guest.id] !== "inside" && after[guest.id] === "inside");
    const declined = scenario.guests.filter((guest) => before[guest.id] !== "left" && after[guest.id] === "left");
    recentlyChanged = new Set([...entered, ...declined].map((guest) => guest.id));

    if (recentlyChanged.size) {
      const outcomeText = [
        entered.length ? `Welcomed: ${entered.map((guest) => guest.name).join(", ")}.` : "",
        declined.length ? `Staying outside: ${declined.map((guest) => guest.name).join(", ")}.` : "",
        pending.filter((guest) => after[guest.id] === "pending").length
          ? `${pending.filter((guest) => after[guest.id] === "pending").length} more ${pending.filter((guest) => after[guest.id] === "pending").length === 1 ? "request is" : "requests are"} still at the door.`
          : "Everyone in this home has a clear answer.",
      ].filter(Boolean).join(" ");
      addMessage("assistant", outcomeText);
    } else if (!result.needsClarification && !result.decisions.length) {
      addMessage("assistant", "I haven’t changed anything yet. Tell me which requests you’re comfortable with, or ask me to explain a guest’s request.");
    }

    if (isHomeDone(game)) $("follow-up").hidden = true;
    render();
  } catch (error) {
    pendingReply.textContent = error.message;
    pendingReply.classList.remove("thinking");
    pendingReply.removeAttribute("aria-label");
  } finally {
    busy = false;
    $("send").disabled = false;
    $("send-label").textContent = "Send my note";
    input.focus();
  }
}

$("chat-form").addEventListener("submit", sendMessage);
$("chat-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("chat-form").requestSubmit();
  }
});

addMessage("assistant", "Welcome in. Tell the host what you’re comfortable with in one note; if I need to check what you mean, I’ll ask a quick follow-up before changing anything.");
render();
