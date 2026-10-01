// Basic interface. Week 7 uses buttons to create intents; Week 8 swaps them for chat + AI.
import { createGame, currentScenario } from "../engine/model.js";
import { enterHome, applyIntent, isHomeDone } from "../engine/rules.js";
import { scenarios } from "../data/scenarios.js";

let game = enterHome(createGame(scenarios), 0);
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text) n.textContent = text;
  return n;
};

function decide(category, decision, scope) {
  const r = applyIntent(game, { category, decision, scope });
  if (!r.ok) { $("notice").textContent = r.error; return; }
  $("notice").textContent = "";
  game = r.state;
  render();
}

function guestCard(guest, status) {
  const card = el("div", `guest ${status}`);
  card.append(el("strong", "", guest.name), el("span", "tag", guest.party === "first" ? "homeowner" : "outside party"));
  card.append(el("p", "", guest.request));
  if (status === "pending") {
    const remember = el("label", "remember");
    const box = el("input"); box.type = "checkbox";
    remember.append(box, " Do the same in every home");
    const row = el("div", "row");
    for (const d of ["accept", "reject"]) {
      const b = el("button", d, d === "accept" ? "Let in" : "Ask to leave");
      b.onclick = () => decide(guest.category, d, box.checked ? "all_homes" : "this_home");
      row.append(b);
    }
    card.append(row, remember);
  } else {
    card.append(el("em", "", status === "inside" ? "Inside the house" : "Outside"));
  }
  return card;
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
    b.onclick = () => { game = enterHome(game, i); render(); };
    nav.append(b);
  });

  $("done").hidden = !isHomeDone(game);
  const prefs = Object.entries(game.standingPreferences);
  $("prefs").textContent = prefs.length ? prefs.map(([c, d]) => `${c}: ${d}`).join(" | ") : "None saved yet";
  $("log").replaceChildren(...game.log.slice().reverse().map((t) => el("li", "", t)));
}

render();
