import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, pendingGuests } from "../src/engine/model.js";
import { enterHome, applyIntent, isHomeDone, validateIntent } from "../src/engine/rules.js";
import { scenarios } from "../src/data/scenarios.js";
import { buildGuestsFromInputs } from "../src/engine/input-adapter.js";

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

test("a specifically welcomed optional guest can later be asked to leave", () => {
  let g = start();
  g = applyIntent(g, { category: "functionality", guestIds: ["dn-lang"], decision: "accept" }).state;
  assert.equal(g.homes["daily-news"].guests["dn-lang"], "inside");
  const r = applyIntent(g, { category: "functionality", guestIds: ["dn-lang"], decision: "reject" });
  assert.equal(r.ok, true);
  assert.equal(r.state.homes["daily-news"].guests["dn-lang"], "left");
  assert.equal(r.state.homes["daily-news"].guests["dn-login"], "pending");
});

test("an essential guest cannot be removed and no other guest is changed", () => {
  const g = enterHome(createGame(scenarios), 1);
  const r = applyIntent(g, { category: "essential", guestIds: ["fs-cart"], decision: "reject" });
  assert.equal(r.ok, false);
  assert.match(r.error, /Cart basket.*cannot be removed/);
  assert.equal(r.state.homes["fit-shop"].guests["fs-cart"], "inside");
  assert.equal(r.state.homes["fit-shop"].guests["fs-prefs"], "pending");
});

test("a guest ID must exist in the current home and match the stated category", () => {
  const g = start();
  const r = applyIntent(g, { category: "functionality", guestIds: ["dn-ads"], decision: "reject" });
  assert.equal(r.ok, false);
  assert.equal(r.state.homes["daily-news"].guests["dn-ads"], "pending");
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

test("input adapter creates metadata-backed guests and applies only matching CMP choices", () => {
  const metadata = [
    { name: "session", domain: "shop.test", secure: true, party: "first" },
    { name: "new_cookie", domain: "new-vendor.test", secure: true, party: "third" },
  ];
  const catalog = [{ cookieName: "session", domain: "shop.test", vendorId: "shop", purposeId: "login", category: "authentication", guestName: "Shop host", request: "Remembers your visit." }];
  const guests = buildGuestsFromInputs({
    cookieMetadata: metadata,
    purposeCatalog: catalog,
    cmpSignal: { status: "readable", choices: [{ vendorId: "shop", purposeId: "login", decision: "accept" }] },
  });
  assert.equal(guests[0].category, "authentication");
  assert.equal(guests[0].initialStatus, "inside");
  assert.equal(guests[0].metadata.secure, true);
  assert.equal(guests[1].category, "unclassified");
  assert.equal(guests[1].initialStatus, "pending");
});

test("generated home starts guests from the adapter while essential remains inside", () => {
  const generated = [{ id: "fixture", name: "Fixture", owner: "Host", story: "Generated.", guests: [
    { id: "essential-cookie", name: "Required", category: "essential", initialStatus: "left", request: "Required." },
    { id: "cmp-denied", name: "Denied vendor", category: "advertising", initialStatus: "left", request: "Ads." },
    { id: "no-signal", name: "Unknown choice", category: "analytics", initialStatus: "pending", request: "Stats." },
  ] }];
  const game = enterHome(createGame(generated), 0);
  assert.equal(game.homes.fixture.guests["essential-cookie"], "inside");
  assert.equal(game.homes.fixture.guests["cmp-denied"], "left");
  assert.equal(game.homes.fixture.guests["no-signal"], "pending");
});

test("a user can reject an exact unclassified guest, but cannot accept it or save a category preference", () => {
  const unknown = buildGuestsFromInputs({ cookieMetadata: [{ name: "mystery", domain: "new.test", party: "third" }] })[0];
  const generated = [{ id: "unknown-fixture", name: "New site", owner: "Host", story: "Generated.", guests: [unknown] }];
  const game = enterHome(createGame(generated), 0);
  assert.equal(game.homes["unknown-fixture"].guests[unknown.id], "pending");
  const reject = applyIntent(game, { category: "unclassified", guestIds: [unknown.id], decision: "reject" });
  assert.equal(reject.ok, true);
  assert.equal(reject.state.homes["unknown-fixture"].guests[unknown.id], "left");
  assert.equal(applyIntent(game, { category: "unclassified", guestIds: [unknown.id], decision: "accept" }).ok, false);
  assert.equal(applyIntent(game, { category: "unclassified", guestIds: [unknown.id], decision: "reject", scope: "all_homes" }).ok, false);
});

test("new cookie and CMP IDs can be connected with catalog data without changing the adapter", () => {
  const guests = buildGuestsFromInputs({
    cookieMetadata: [{ name: "new_feature_state", domain: "brand-new-shop.test", path: "/", expires: "7 days", secure: true, httpOnly: true, sameSite: "Strict", party: "first" }],
    purposeCatalog: [{ cookieName: "new_feature_state", domain: "brand-new-shop.test", vendorId: "brand-new-shop", purposeId: "saved-layout", vendorName: "Brand New Shop", guestName: "Layout notebook", category: "functionality", request: "Remembers the layout you selected." }],
    cmpSignal: { status: "readable", format: "demo", choices: [{ vendorId: "brand-new-shop", purposeId: "saved-layout", decision: "reject" }] },
  });
  assert.equal(guests[0].name, "Layout notebook");
  assert.equal(guests[0].category, "functionality");
  assert.equal(guests[0].cmpDecision, "reject");
  assert.equal(guests[0].initialStatus, "left");
  assert.equal(guests[0].metadata.name, "new_feature_state");
});
