import { buildGuestsFromInputs } from "../engine/input-adapter.js";

const $ = (id) => document.getElementById(id);
let cmpMode = "missing";
let answerMode = "clear";
let lastBuiltGuests = [];

const metadataFixture = [
  { name: "basket_id", domain: "shop.test", path: "/", expires: "30 days", secure: true, httpOnly: true, sameSite: "Lax", party: "first" },
  { name: "ns_ad_id", domain: "ads.northstar.test", path: "/", expires: "90 days", secure: true, httpOnly: false, sameSite: "Lax", party: "third" },
  { name: "x7", domain: "edge.unknown.test", path: "/", expires: "session", secure: true, httpOnly: false, sameSite: "unspecified", party: "third" },
];
const purposeCatalogFixture = [
  { cookieName: "basket_id", domain: "shop.test", vendorId: "shop", purposeId: "basket", vendorName: "Shop owner", guestName: "Basket keeper", category: "functionality", party: "first", request: "Remembers the basket while you browse.", evidence: "test-site disclosure v1" },
  { cookieName: "ns_ad_id", domain: "ads.northstar.test", vendorId: "northstar", purposeId: "personalised-ads", vendorName: "Northstar Ads", guestName: "Northstar ad guest", category: "advertising", party: "third", request: "Uses activity to personalise advertising.", evidence: "test-site disclosure v1" },
];
const cmpFixture = {
  status: "readable", format: "TCF/GPP decoded adapter record", version: "demo-v1",
  choices: [{ vendorId: "northstar", purposeId: "personalised-ads", decision: "reject" }],
};

function setInputFixtures() {
  $("metadata-input").value = JSON.stringify(metadataFixture, null, 2);
  $("catalog-input").value = JSON.stringify(purposeCatalogFixture, null, 2);
  setCmpFixture();
}

function setCmpFixture() {
  $("cmp-input").value = JSON.stringify(cmpMode === "available" ? cmpFixture : { status: "not_readable", choices: [] }, null, 2);
}

function renderCmpRecords(cmpSignal, cookieMetadata, purposeCatalog) {
  const host = $("generated-cmp");
  host.replaceChildren();
  const choices = cmpSignal?.status === "readable" && Array.isArray(cmpSignal.choices) ? cmpSignal.choices : [];
  if (!choices.length) {
    const note = document.createElement("p");
    note.textContent = cmpSignal?.status === "readable" ? "Readable CMP signal contains no vendor/purpose choices." : "No readable CMP choices were supplied. Cookies remain pending unless essential.";
    host.append(note);
    return;
  }
  for (const choice of choices) {
    const mapping = purposeCatalog.find((entry) => entry.vendorId === choice.vendorId && entry.purposeId === choice.purposeId);
    const observed = mapping && cookieMetadata.some((cookie) => cookie.name === mapping.cookieName && cookie.domain === mapping.domain);
    const row = document.createElement("article");
    row.className = `cmp-record ${mapping && observed ? "cmp-linked" : "cmp-unlinked"}`;
    const title = document.createElement("strong"); title.textContent = `${choice.vendorId || "Unknown vendor"} · ${choice.purposeId || "Unknown purpose"}`;
    const decision = document.createElement("span"); decision.textContent = String(choice.decision || "no decision").toUpperCase();
    const explanation = document.createElement("p");
    explanation.textContent = mapping && observed
      ? `Matched to ${mapping.cookieName} at ${mapping.domain} through catalog IDs. This choice can initialize that guest.`
      : mapping
        ? `Catalog entry exists for ${mapping.cookieName}, but that cookie is not in the metadata input. No guest is changed.`
        : "No catalog entry has these vendor/purpose IDs. Signal is shown as unmatched and changes no guest.";
    row.append(title, decision, explanation); host.append(row);
  }
}

function renderGuestRoster() {
  const host = $("generated-guests");
  host.replaceChildren();
  try {
    const cookieMetadata = JSON.parse($("metadata-input").value);
    const cmpSignal = JSON.parse($("cmp-input").value);
    const purposeCatalog = JSON.parse($("catalog-input").value);
    const guests = buildGuestsFromInputs({ cookieMetadata, purposeCatalog, cmpSignal });
    // Keep the surrounding walkthrough cues in sync when someone edits the JSON directly.
    cmpMode = cmpSignal?.status === "readable" ? "available" : "missing";
    render();
    renderCmpRecords(cmpSignal, cookieMetadata, purposeCatalog);
    lastBuiltGuests = guests;
    $("input-error").textContent = "";
    $("open-generated").hidden = !guests.length;
    $("generated-count").textContent = `${guests.length} generated`;
    for (const guest of guests) {
      const card = document.createElement("article");
      card.className = `generated-guest ${guest.initialStatus === "pending" ? "guest-pending" : guest.initialStatus === "inside" ? "guest-inside" : "guest-outside"}`;
      const top = document.createElement("div"); top.className = "generated-guest-top";
      const title = document.createElement("strong"); title.textContent = guest.name;
      const state = document.createElement("span"); state.textContent = guest.initialStatus === "pending" ? "AT THE DOOR" : guest.initialStatus === "inside" ? "WELCOMED" : "OUTSIDE";
      top.append(title, state); card.append(top);
      const category = document.createElement("p"); category.textContent = `Category: ${guest.category}`; card.append(category);
      const request = document.createElement("p"); request.textContent = guest.request; card.append(request);
      const meta = document.createElement("details");
      const summary = document.createElement("summary"); summary.textContent = `Cookie metadata · ${guest.metadata.name}`;
      const details = document.createElement("p");
      details.textContent = `${guest.metadata.domain} · path ${guest.metadata.path} · ${guest.metadata.expires} · Secure ${guest.metadata.secure} · HttpOnly ${guest.metadata.httpOnly} · SameSite ${guest.metadata.sameSite} · ${guest.metadata.party}-party · purpose evidence: ${guest.purposeEvidence}${guest.cmpDecision ? ` · CMP: ${guest.cmpDecision}` : ""}`;
      meta.append(summary, details); card.append(meta); host.append(card);
    }
  } catch (error) {
    lastBuiltGuests = [];
    $("generated-cmp").replaceChildren();
    $("open-generated").hidden = true;
    $("input-error").textContent = `Input format error: ${error.message}`;
    $("generated-count").textContent = "Not built";
  }
}

const clearOutput = (withCmp) => ({
  inputEvidence: {
    cookieMetadata: ["basket_id", "ns_ad_id", "x7"],
    cmpSignal: withCmp
      ? { status: "readable", format: "GPP / TCF demo", vendor: "Northstar Ads", purpose: "personalised advertising", recordedChoice: "deny" }
      : { status: "not_readable", effect: "no choice inferred" },
  },
  userMessage: "Keep my basket, but don’t use my activity for personalised ads.",
  needsClarification: false,
  preferences: [
    { category: "functionality", decision: "accept", scope: "this_home", evidence: "explicit user statement" },
    {
      category: "advertising",
      decision: "reject",
      scope: "this_home",
      evidence: withCmp ? "explicit user statement; consistent with CMP signal" : "explicit user statement",
    },
  ],
  unmappedCookies: [{ name: "x7", status: "unknown; held for clarification" }],
  deterministicChanges: withCmp
    ? ["welcome basket keeper", "keep ad guest outside", "leave x7 pending"]
    : ["welcome basket keeper", "keep ad guest outside", "leave x7 pending"],
});

const unclearOutput = (withCmp) => ({
  inputEvidence: {
    cookieMetadata: ["basket_id", "ns_ad_id", "x7"],
    cmpSignal: withCmp
      ? { status: "readable", format: "GPP / TCF demo", vendor: "Northstar Ads", purpose: "personalised advertising", recordedChoice: "deny" }
      : { status: "not_readable", effect: "no choice inferred" },
  },
  userMessage: "I don’t know what x7 does.",
  needsClarification: true,
  preferences: [],
  clarification: "The purpose for x7 could not be verified. Show a site disclosure or leave this guest undecided?",
  deterministicChanges: [],
});

function render() {
  const available = cmpMode === "available";
  $("cmp-missing").hidden = available;
  $("cmp-available").hidden = !available;
  $("cmp-status").textContent = available ? "SIGNAL MATCHED" : "NOT READABLE";
  $("cmp-status").className = `lane-state ${available ? "matched-state" : ""}`;
  $("cmp-subtitle").textContent = available ? "A vendor and purpose choice is available" : "A CMP signal was not readable on this visit";
  $("cmp-explanation").textContent = available
    ? "The signal adds a recorded choice for Northstar Ads. The user can still state a different current preference in the conversation."
    : "The metadata and catalog can still build a useful prompt when the CMP signal is missing.";
  $("ad-mapping-row").querySelector(".evidence-badge").textContent = available ? "Disclosure + CMP" : "Test-site disclosure";
  $("ad-mapping-row").querySelector(".evidence-badge").className = `evidence-badge${available ? " verified" : ""}`;
  $("ad-handling").textContent = available ? "Prefill: denied" : "Ask user";
  $("ad-handling").className = `handling-pill ${available ? "prefill" : "ask"}`;
  for (const button of document.querySelectorAll(".mode-button")) {
    const active = button.dataset.mode === cmpMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  for (const button of document.querySelectorAll(".answer-button")) {
    const active = button.dataset.answer === answerMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  }

  const unclear = answerMode === "unclear";
  $("sample-message").textContent = unclear
    ? "“I don’t know what x7 does.”"
    : "“Keep my basket, but don’t use my activity for personalised ads.”";
  $("answer-feedback").textContent = unclear
    ? "No clear preference can be extracted from this message. The system asks for trustworthy context; no guest moves."
    : available
      ? "Two clear choices are extracted. The ad choice matches the CMP signal; x7 stays undecided."
      : "Two clear choices are extracted from the user’s words. The missing CMP signal does not block the flow; x7 stays undecided.";
  $("output-state").textContent = unclear ? "CLARIFICATION" : "EXPLICIT";
  $("output-state").className = `output-state${unclear ? " clarify-state" : ""}`;
  $("output-json").textContent = JSON.stringify(unclear ? unclearOutput(available) : clearOutput(available), null, 2);
  $("rule-copy").textContent = unclear
    ? "No changes. Keep x7 pending until its purpose is verified and the user makes a clear choice."
    : "Deterministic rules welcome the basket keeper, keep the ad guest outside, and leave x7 pending.";
}

for (const button of document.querySelectorAll(".mode-button")) {
  button.addEventListener("click", () => {
    if (!button.dataset.mode) return;
    cmpMode = button.dataset.mode;
    setCmpFixture();
    render();
    renderGuestRoster();
  });
}
for (const button of document.querySelectorAll(".answer-button")) {
  button.addEventListener("click", () => {
    answerMode = button.dataset.answer;
    render();
  });
}

render();
setInputFixtures();
renderGuestRoster();
$("build-guests").addEventListener("click", renderGuestRoster);
$("open-generated").addEventListener("click", () => {
  if (!lastBuiltGuests.length) return;
  sessionStorage.setItem("cookiehomes.generatedScenario", JSON.stringify({ name: "shop.test", guests: lastBuiltGuests }));
  window.location.href = "/";
});
