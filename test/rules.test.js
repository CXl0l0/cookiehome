import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, pendingGuests } from "../src/engine/model.js";
import { enterHome, applyIntent, isHomeDone, validateIntent } from "../src/engine/rules.js";
import { scenarios } from "../src/data/scenarios.js";

const start = () => enterHome(createGame(scenarios), 0);

test("essential guests enter automatically, others wait", () => {
  const g = start();
  assert.equal(g.homes["daily-news"].guests["dn-session"], "inside");
  assert.equal(pendingGuests(g).length, 4);
});

test("accept lets guest in, reject makes guest leave", () => {
  let r = applyIntent(start(), { category: "analytics", decision: "accept" });
  r = applyIntent(r.state, { category: "advertising", decision: "reject" });
  assert.equal(r.state.homes["daily-news"].guests["dn-stats"], "inside");
  assert.equal(r.state.homes["daily-news"].guests["dn-ads"], "left");
});

test("essential cannot be changed; bad intents are rejected", () => {
  assert.equal(applyIntent(start(), { category: "essential", decision: "reject" }).ok, false);
  assert.ok(validateIntent({ category: "cookies", decision: "accept" }));
});

test("all_homes preference auto-applies in the next home", () => {
  const r = applyIntent(start(), { category: "advertising", decision: "reject", scope: "all_homes" });
  const g = enterHome(r.state, 1);
  assert.equal(g.homes["fit-shop"].guests["fs-ads"], "left");
  assert.equal(g.homes["fit-shop"].guests["fs-stats"], "pending");
});

test("engine is deterministic and does not mutate input", () => {
  const g = start(); const snap = JSON.stringify(g);
  const a = applyIntent(g, { category: "analytics", decision: "accept" });
  const b = applyIntent(g, { category: "analytics", decision: "accept" });
  assert.equal(JSON.stringify(g), snap);
  assert.deepEqual(a.state, b.state);
});

test("home is done once nobody is pending", () => {
  let s = start();
  for (const c of ["authentication", "functionality", "analytics", "advertising"])
    s = applyIntent(s, { category: c, decision: "accept" }).state;
  assert.ok(isHomeDone(s));
});
