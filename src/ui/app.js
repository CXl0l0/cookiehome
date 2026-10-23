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
      initialScenarios = [{ id: "generated-site", name: imported.name || "Generated test site", owner: "the site owner", story: imported.story || "This home was built from cookie metadata and public purpose disclosures. Each guest's request is presented as a scenario; unknown purposes include browser-storage clues and remain uncertain.", guests: imported.guests }];
    }
    sessionStorage.removeItem("cookiehomes.generatedScenario");
  }
} catch { /* fall back to the built-in homes if imported demo data is invalid */ }
let game = enterHome(createGame(initialScenarios), 0);
let chatHistory = [];
let activeFollowUp = null;
let activeGuestId = null;
let dialogGuestId = null;
let busy = false;
let recentlyChanged = new Set();

const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text) node.textContent = text;
  return node;
};
const shortLabels = {
  authentication: "Remember me",
  functionality: "Personal settings",
  analytics: "Visit statistics",
  advertising: "Ad tracking",
};

function purposeLabel(guest) {
  if (guest.category === "unclassified") {
    return guest.purposeDescription ? "Purpose known · category unclassified" : "Purpose not verified";
  }
  return shortLabels[guest.category] ?? guest.category;
}

function guestEvidence(guest) {
  const evidence = [];
  if (guest.purposeDescription) evidence.push(`Published purpose: ${guest.purposeDescription}`);
  if (guest.purposeEvidence) evidence.push(`Evidence: ${guest.purposeEvidence}`);
  if (guest.cmpDecision) evidence.push(`Consent setting: ${guest.cmpDecision}`);
  if (guest.metadata) {
    const m = guest.metadata;
    evidence.push(`Browser details: ${m.name} · ${m.domain} · path ${m.path} · ${m.expires} · Secure ${m.secure} · HttpOnly ${m.httpOnly} · SameSite ${m.sameSite} · ${m.party}-party`);
  }
  return evidence.join("\n") || "No additional purpose details or evidence were found.";
}

function addMessage(role, content) {
  const bubble = el("p", `message ${role}`, content);
  $("chat-messages").append(bubble);
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
  return bubble;
}

function guestCard(guest, status) {
  const card = el("button", `guest ${status}${guest.party === "third" ? " third-party" : ""}${recentlyChanged.has(guest.id) ? " updated" : ""}${activeGuestId === guest.id ? " selected" : ""}`);
  card.type = "button";
  card.dataset.guestId = guest.id;
  card.setAttribute("aria-haspopup", "dialog");
  const top = el("span", "guest-top");
  top.append(el("span", "guest-avatar", guest.name.trim().charAt(0).toUpperCase()));
  top.append(el("strong", "guest-name", guest.name));
  const stateLabel = status === "pending" ? "At the door" : status === "inside" ? "Welcomed" : "Outside";
  top.append(el("span", "guest-state", stateLabel));
  card.append(top);
  const category = guest.category === "unclassified" && !guest.purposeDescription ? "Purpose unknown" : purposeLabel(guest);
  card.append(el("span", "guest-party", category));
  card.append(el("span", "guest-open-hint", status === "pending" ? "Explore this scenario" : "Review this scenario"));
  card.setAttribute("aria-label", `${guest.name}, ${category}, ${stateLabel}. Open scenario.`);
  card.addEventListener("click", () => openScenario(guest.id));
  return card;
}

function openScenario(guestId) {
  const scenario = currentScenario(game);
  const guest = scenario.guests.find((item) => item.id === guestId);
  if (!guest) return;
  const status = game.homes[scenario.id].guests[guest.id];
  dialogGuestId = guest.id;
  $("dialog-avatar").textContent = guest.name.trim().charAt(0).toUpperCase();
  $("scenario-dialog-title").textContent = guest.name;
  $("dialog-status").textContent = status === "pending" ? "Waiting at the door" : status === "inside" ? "Welcomed inside" : "Staying outside";
  $("dialog-category").textContent = purposeLabel(guest);
  $("dialog-request").textContent = guest.request;
  $("dialog-evidence-copy").textContent = guestEvidence(guest);
  $("dialog-evidence").hidden = false;
  $("dialog-evidence").open = false;
  const dialog = $("scenario-dialog");
  if (!dialog.open) dialog.showModal();
}

function updateActiveGuest() {
  const scenario = currentScenario(game);
  const guest = scenario.guests.find((item) => item.id === activeGuestId);
  $("focused-scenario").hidden = !guest;
  $("chat-focused-guest").hidden = !guest;
  if (guest) {
    const status = game.homes[scenario.id].guests[guest.id];
    $("focused-scenario-name").textContent = guest.name;
    $("focused-scenario-status").textContent = status === "inside" ? "Welcomed" : status === "left" ? "Outside" : "At the door";
    $("focused-scenario-story").textContent = guest.request;
    $("focused-scenario-evidence").textContent = guestEvidence(guest);
    $("chat-focused-name").textContent = guest.name;
  }
  $("chat-context").textContent = guest ? `A focused conversation · ${scenario.name}` : `Choose a guest to focus the chat · ${scenario.name}`;
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
  activeGuestId = null;
  dialogGuestId = null;
  $("scenario-dialog").close();
  recentlyChanged = new Set();
  $("follow-up").hidden = true;
  $("chat-messages").replaceChildren();
  const scenario = currentScenario(game);
  addMessage("assistant", `Welcome to ${scenario.name}. Choose a guest to explore a scenario, or share a preference for the whole home.`);
  render();
  $("chat-input").placeholder = "Ask about a guest, or tell the host what you’re comfortable with…";
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

  $("guest-count").textContent = waiting.length ? `${waiting.length} waiting` : "No open requests";
  const settledCount = welcomed.length + outside.length;
  $("settled-summary").textContent = settledCount
    ? `See current choices · ${welcomed.length} welcomed, ${outside.length} outside`
    : "See current choices · none yet";

  $("home-name").textContent = scenario.name;
  updateActiveGuest();
  $("owner").textContent = `Hosted by ${scenario.owner}`;
  $("home-step").textContent = `HOME ${String(game.currentHome + 1).padStart(2, "0")} · ${completed ? "VISIT COMPLETE" : game.currentHome === 0 ? "YOUR FIRST STOP" : "YOUR NEXT STOP"}`;
  $("home-brief").textContent = completed
    ? "This visit is complete. Open any guest to review or change your choice."
    : waiting.length
      ? "Choose a guest to see their scenario, then decide through chat."
      : "Everyone has an answer. Open a guest to review or change your choice.";

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
        // Rebuild every zone from game state. A partial refresh can leave stale
        // cards behind when the last guest leaves a zone or enters an empty one.
        render();
      }
    }, 650);
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
          currentGuests: scenario.guests.map((guest) => ({
            id: guest.id,
            name: guest.name,
            category: guest.category,
            request: guest.request,
            purposeDescription: guest.purposeDescription,
            purposeEvidence: guest.purposeEvidence,
            status: home.guests[guest.id],
          })),
          activeScenario: scenario.guests.find((guest) => guest.id === activeGuestId)
            ? (() => {
                const guest = scenario.guests.find((item) => item.id === activeGuestId);
                return { id: guest.id, name: guest.name, category: guest.category, request: guest.request, purposeDescription: guest.purposeDescription, purposeEvidence: guest.purposeEvidence };
              })()
            : null,
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
      $("chat-input").placeholder = `Reply to the helper…`;
    } else {
      activeFollowUp = null;
      $("follow-up").hidden = true;
      $("chat-input").placeholder = activeGuestId ? "Ask about this guest, or say what you want the host to do…" : "Ask about a guest, or tell the host what you’re comfortable with…";
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
$("close-scenario").addEventListener("click", () => $("scenario-dialog").close());
$("discuss-scenario").addEventListener("click", () => {
  if (!dialogGuestId) return;
  activeGuestId = dialogGuestId;
  $("scenario-dialog").close();
  $("focused-scenario-details").open = false;
  updateActiveGuest();
  $("chat-input").placeholder = "Ask about this guest, or say what you want the host to do…";
  const focusedScenario = $("focused-scenario");
  const chatInput = $("chat-input");
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  focusedScenario.scrollIntoView({ behavior, block: "center" });
  chatInput.focus({ preventScroll: true });
});
$("clear-scenario").addEventListener("click", () => {
  activeGuestId = null;
  updateActiveGuest();
  $("chat-input").placeholder = "Ask about a guest, or tell the host what you’re comfortable with…";
  render();
});
$("scenario-dialog").addEventListener("click", (event) => {
  if (event.target === $("scenario-dialog")) $("scenario-dialog").close();
});
$("theme-toggle").addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nextTheme;
  try { localStorage.setItem("cookiehomes.theme", nextTheme); } catch { /* the toggle still works for this page */ }
  const dark = nextTheme === "dark";
  $("theme-toggle").setAttribute("aria-pressed", String(dark));
  $("theme-toggle").setAttribute("aria-label", `Switch to ${dark ? "light" : "dark"} mode`);
  $("theme-label").textContent = dark ? "Light mode" : "Dark mode";
  $("theme-toggle").querySelector(".theme-icon").textContent = dark ? "☀" : "☾";
  document.querySelector("meta[name='theme-color']").content = dark ? "#121a1b" : "#f5f7f4";
});
$("chat-input").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("chat-form").requestSubmit();
  }
});

try {
  const savedTheme = localStorage.getItem("cookiehomes.theme");
  if (savedTheme === "dark" || savedTheme === "light") document.documentElement.dataset.theme = savedTheme;
} catch { /* theme preference is optional when storage is unavailable */ }
const isDark = document.documentElement.dataset.theme === "dark";
$("theme-toggle").setAttribute("aria-pressed", String(isDark));
$("theme-toggle").setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} mode`);
$("theme-label").textContent = isDark ? "Light mode" : "Dark mode";
$("theme-toggle").querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
document.querySelector("meta[name='theme-color']").content = isDark ? "#121a1b" : "#f5f7f4";
addMessage("assistant", "Welcome in. Choose a guest to explore their scenario, or tell the host what you’re comfortable with. I’ll ask before applying an unclear choice.");
render();
