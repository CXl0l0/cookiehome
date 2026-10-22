// Deterministic rule engine. Pure functions: same state + same intent = same result.
// In Week 8 the AI will output an `intent` in the exact shape validated below.
//
// intent = { category, decision: "accept"|"reject", scope?: "this_home"|"all_homes" }

import { CATEGORIES, DECISIONS, SCOPES, currentScenario } from "./model.js";

const clone = (x) => structuredClone(x);
const say = (g, text) => g.log.push(text);

export function validateIntent(intent) {
  if (!intent || (!CATEGORIES.includes(intent.category) && intent.category !== "unclassified")) return "Unknown category.";
  if (!DECISIONS.includes(intent.decision)) return "Decision must be accept or reject.";
  if (intent.scope && !SCOPES.includes(intent.scope)) return "Unknown scope.";
  if (intent.guestIds !== undefined && (!Array.isArray(intent.guestIds) || !intent.guestIds.length || intent.guestIds.some((id) => typeof id !== "string") || new Set(intent.guestIds).size !== intent.guestIds.length)) {
    return "Guest targets must be a non-empty list of unique guest IDs.";
  }
  if (intent.category === "unclassified" && intent.scope === "all_homes") return "A choice about an unknown-purpose guest can only apply to this home.";
  if (intent.category === "unclassified" && !intent.guestIds?.length) return "An unknown-purpose guest must be accepted or rejected by its specific guest ID.";
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
      if (guest.initialStatus === "inside" || guest.initialStatus === "left") {
        home.guests[guest.id] = guest.initialStatus;
        say(g, `${guest.name}: the mapped input signal marked this guest ${guest.initialStatus}.`);
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

// Apply one structured privacy decision to specific guests, including changing a past choice.
export function applyIntent(state, intent) {
  const error = validateIntent(intent);
  if (error) return { state, ok: false, error };

  const g = clone(state);
  const scenario = currentScenario(g);
  const home = g.homes[scenario.id];
  const categoryGuests = scenario.guests.filter((guest) => guest.category === intent.category);
  const selectedGuests = intent.guestIds
    ? categoryGuests.filter((guest) => intent.guestIds.includes(guest.id))
    : categoryGuests;

  if (!selectedGuests.length) {
    return { state, ok: false, error: "Those guests are not part of this home or do not match that request." };
  }
  if (selectedGuests.some((guest) => guest.category === "essential")) {
    const names = selectedGuests.filter((guest) => guest.category === "essential").map((guest) => guest.name);
    return { state, ok: false, error: `${names.join(", ")} ${names.length === 1 ? "is" : "are"} essential to this home and cannot be removed.` };
  }

  // A lasting category preference applies to all guests of that category here and in future homes.
  const targets = intent.scope === "all_homes" ? categoryGuests : selectedGuests;
  const nextStatus = intent.decision === "accept" ? "inside" : "left";
  const changed = targets.filter((guest) => home.guests[guest.id] !== nextStatus);
  if (!changed.length && intent.scope !== "all_homes") {
    return { state, ok: false, error: "Those guests already match that choice." };
  }

  if (intent.scope === "all_homes") {
    g.standingPreferences[intent.category] = intent.decision;
    say(g, `Saved: ${intent.category} will be ${intent.decision}ed in every home.`);
  }
  for (const guest of changed) {
    const previousStatus = home.guests[guest.id];
    home.guests[guest.id] = nextStatus;
    say(g, intent.decision === "accept"
      ? guest.category === "unclassified"
        ? `You welcome ${guest.name} inside despite its unverified purpose.`
        : `You welcome ${guest.name} inside.`
      : previousStatus === "inside" ? `You ask ${guest.name} to leave.` : `You keep ${guest.name} outside.`);
  }
  return { state: g, ok: true };
}

export const isHomeDone = (state, index = state.currentHome) => {
  const s = state.scenarios[index];
  const home = state.homes[s.id];
  return home.visited && s.guests.every((x) => home.guests[x.id] !== "pending");
};
