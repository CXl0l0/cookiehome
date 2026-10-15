# Cookie Homes (CP4106)

Cookie Homes turns privacy choices into a conversation about guests entering a website's home. The Week 7 rule engine remains deterministic; the Week 8 AI layer only converts what the user says into structured decisions.

## Run the prototype

Requires Node.js 18 or newer and a Gemini API key.

In PowerShell, from this folder:

```powershell
$env:GEMINI_API_KEY = "your-gemini-api-key"
# Optional: choose another Gemini model
$env:GEMINI_MODEL = "gemini-3.5-flash-lite"
npm start
```

Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey). Open http://localhost:3000. The key is read only by the local server and is never sent to the browser. Do not commit the key. The prototype sends the current chat turns and the current home's pending guest descriptions to Gemini for interpretation. Check the current [Gemini API pricing and free-tier terms](https://ai.google.dev/gemini-api/docs/pricing) for quota and data handling details.

The navigation includes **How the inputs work**, an interactive fixture at `/input-demo.html`. Its JSON editors accept cookie observations, a separate CMP signal, and an editable purpose-link catalog. `src/engine/input-adapter.js` joins these records and builds the displayed guest roster. The catalog is data, not a code lookup: adding a cookie/vendor/purpose mapping there lets the same adapter process a new cookie and CMP choice. Each generated guest shows source metadata, category evidence, and initial status: essential is inside, a matching readable CMP choice is reflected, and otherwise a known guest waits at the door. A cookie without a catalog match appears as an unclassified guest; unmatched CMP choices are shown separately and do not affect guests. The page also demonstrates the preference interpreter output; it does not inspect real browser traffic or call Gemini for this demo.

Prototype cookie metadata record: `{ name, domain, path, expires, secure, httpOnly, sameSite, party }`. Prototype CMP record: `{ status, format, version, choices: [{ vendorId, purposeId, decision }] }`. These are normalized adapter contracts for this project, not universal browser/CMP standards. The editable purpose catalog links an observed cookie name+domain to vendor and purpose IDs, one of the five prototype categories, and a human-readable request. These shared IDs are the bridge between inputs; metadata and CMP records alone cannot reliably identify that relationship. If there is no catalog row, the cookie and CMP choice remain visible but unlinked. A production browser extension would need real browser observation, CMP-specific decoders, versioned site disclosures, matching safeguards, and explicit handling of conflicts between sources.

## Week 8 interaction path

```text
Chat message -> POST /api/chat -> structured AI decisions -> validate/applyIntent -> visible house state
```

The server asks the Gemini generateContent API for a JSON response matching a schema containing a short reply, an ambiguity flag, a linked follow-up scenario, and zero or more `{ guestIds, category, decision, scope }` decisions. Each decision must target exact guest IDs in the current home's roster. This prevents the interpreter from silently substituting a different guest when a user names one. A clear rejection can reverse a previous welcome for an optional guest; essential guests such as FitShop's cart basket remain inside and receive a specific explanation. Ambiguity creates a clarification scenario with no game changes; a clear but partial answer can apply its explicit choices and create a next scenario for the still-unanswered requests. The scenario is tied to the current home and carried into the next request as context. Clear choices go through `applyIntent`; the model cannot directly modify game state. `scope` defaults to `this_home`; the AI uses `all_homes` only when the user explicitly asks for a lasting preference.

## Prototype architecture

```text
Home story + pending guests + recent chat + active scenario
                         |
                         v
             Gemini intent interpreter
       (reply, clarification scene, structured intent)
                         |
             server-side schema checks
                         |
         deterministic validate/applyIntent
                         |
       guest status + preference + event log
```

The AI proposes structured intent; it does not move guests. The rule engine rejects unsupported categories and decisions, essential cookies cannot be changed, and ambiguous replies apply no preference. An unclassified guest is included in the chat context and can be rejected by its exact ID for the current home; it cannot be accepted or saved as an all-home category until its purpose is identified. Follow-up scenes are conversational scaffolding: they clarify an existing request and do not themselves create a guest or grant permission.

## Realistic project scope

This is a small, scenario-based preference elicitation prototype, not a reliable privacy profile extractor or a browser cookie manager. Its useful research question is whether contextual natural-language prompts help users express explicit choices, and how often the interpreter maps those choices correctly or asks for clarification. The current demo uses a few hand-authored homes and a small category set; it does not inspect real websites, verify cookie behavior, or prove that choices generalize to every site. Test ambiguous, mixed, contradictory, and out-of-scope replies with participants, and compare the extracted choices with a direct preference questionnaire before claiming improved accuracy or usability.

The Gemini-backed chat requires an API key and network access. User messages, recent conversation turns, and current pending guest descriptions are sent to Google's Gemini API from the local server. Do not use sensitive personal data in this prototype; check provider terms and institutional research requirements before participant testing. The deterministic state engine can still be tested without an API key.

## Useful next steps for the project

1. Test natural, mixed, vague, and contradictory phrases with classmates. Track incorrect category mappings and cases where the AI should ask a follow-up.
2. Add a review/undo step before applying decisions if user testing finds incorrect interpretations hard to recover from.
3. For a production or public demo, add rate limiting, avoid sending unnecessary conversation history, and document the AI provider's data handling.
4. Later, replace the Gemini adapter in `server.js` with a local model or another provider if local-only processing is a project requirement.

## Project structure

- `server.js` - static server and server-side Gemini API proxy, including clarification schema validation
- `input-demo.html`, `input-demo.css`, `src/ui/input-demo.js` - interactive metadata/CMP input editor and generated guest roster
- `src/engine/input-adapter.js` - normalized metadata + CMP + purpose-catalog to guest adapter
- `src/engine/model.js` - state model and categories
- `src/engine/rules.js` - deterministic `enterHome`, `applyIntent`, and validation
- `src/data/scenarios.js` - hand-authored home stories and guest requests
- `src/ui/app.js` - one-note-per-home conversation, adaptive scenario display, choice progress, outcome recap, and game rendering
- `test/rules.test.js` - deterministic rule engine tests (`npm test`)
