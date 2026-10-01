// Deterministic rule engine. Pure functions: same state + same intent = same result.
// In Week 8 the AI will output an `intent` in the exact shape validated below.
//
// intent = { category, decision: "accept"|"reject", scope?: "this_home"|"all_homes" }

import { CATEGORIES, DECISIONS, SCOPES, currentScenario } from "./model.js";

const clone = (x) => structuredClone(x);
const say = (g, text) => g.log.push(text);

export function validateIntent(intent) {
  if (!intent || !CATEGORIES.includes(intent.category)) return "Unknown category.";
  if (!DECISIONS.includes(intent.decision)) return "Decision must be accept or reject.";
  if (intent.scope && !SCOPES.includes(intent.scope)) return "Unknown scope.";
  return null;
}

// Move into a home: guests arrive, then standing preferences are applied automatically.
export function enterHome(state, index) {
  const g = clone(state);
  g.currentHome = index;
  const scenario = currentScenario(g);
  const home = g.homes[scenario.id];
  if (!home.visited) {
    home.visited = true;
    say(g, `You arrive at ${scenario.name}. ${scenario.owner} greets you.`);
    for (const guest of scenario.guests) {
      if (guest.category === "essential") {
        home.guests[guest.id] = "inside";
        say(g, `${guest.name} is needed to keep the house working, so they come in.`);
        continue;
      }
      const saved = g.standingPreferences[guest.category];
      if (saved) {
        home.guests[guest.id] = saved === "accept" ? "inside" : "left";
        say(g, `${guest.name}: your saved ${guest.category} choice (${saved}) was applied.`);
      } else {
        home.guests[guest.id] = "pending";
      }
    }
  }
  return g;
}

// Apply one structured privacy decision to the current home.
export function applyIntent(state, intent) {
  const error = validateIntent(intent);
  if (error) return { state, ok: false, error };

  if (intent.category === "essential") {
    return { state, ok: false, error: "Essential cookies can't be changed." };
  }

  const g = clone(state);
  const scenario = currentScenario(g);
  const home = g.homes[scenario.id];
  const targets = scenario.guests.filter((x) => x.category === intent.category);
  const pending = targets.filter((x) => home.guests[x.id] === "pending");

  if (pending.length === 0 && intent.scope !== "all_homes") {
    return { state, ok: false, error: "No one here is waiting on that." };
  }
  if (intent.scope === "all_homes") {
    g.standingPreferences[intent.category] = intent.decision;
    say(g, `Saved: ${intent.category} will be ${intent.decision}ed in every home.`);
  }
  for (const guest of pending) {
    home.guests[guest.id] = intent.decision === "accept" ? "inside" : "left";
    say(g, intent.decision === "accept"
      ? `You welcome ${guest.name} inside.`
      : `You ask ${guest.name} to leave.`);
  }
  return { state: g, ok: true };
}

export const isHomeDone = (state, index = state.currentHome) => {
  const s = state.scenarios[index];
  const home = state.homes[s.id];
  return home.visited && s.guests.every((x) => home.guests[x.id] !== "pending");
};
