// Initial state model. Everything the game knows lives in one plain object.

export const CATEGORIES = ["essential", "authentication", "functionality", "analytics", "advertising"];
export const DECISIONS = ["accept", "reject"];
export const SCOPES = ["this_home", "all_homes"];

// Guest status: pending (waiting at the door) | inside | left
export function createGame(scenarios) {
  return {
    scenarios,
    currentHome: 0,
    homes: Object.fromEntries(
      scenarios.map((s) => [s.id, { visited: false, guests: {} }])
    ),
    // Saved "all homes" preferences, e.g. { advertising: "reject" }
    standingPreferences: {},
    log: [],
  };
}

export const currentScenario = (g) => g.scenarios[g.currentHome];
export const pendingGuests = (g) => {
  const home = g.homes[currentScenario(g).id];
  return currentScenario(g).guests.filter((x) => home.guests[x.id] === "pending");
};
