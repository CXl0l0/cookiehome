# Cookie Homes (CP4106)

Cookie Homes turns privacy choices into a conversation about guests entering a website's home. The Week 7 rule engine remains deterministic; the Week 8 AI layer only converts what the user says into structured decisions.

## Run the prototype

Requires Node.js 18 or newer. A Gemini API key is needed only for chatbot interpretation; the input demo and browser connector work without it.

Create a local `.env` file in the project folder from the provided template, then fill in whichever services you use:

```powershell
Copy-Item .env.example .env
notepad .env
npm start
```

The server loads `.env` on startup, so after the one-time setup you can start the project with `npm start`. `.env` is ignored by Git. Values set in the current PowerShell session override values in the file. Create a Gemini key in [Google AI Studio](https://aistudio.google.com/app/apikey). The Gemini key is read only by the local server and is never sent to the browser. Do not commit the Gemini API key. The prototype sends the current chat turns and the current home's pending guest descriptions to Gemini for interpretation. Check the current [Gemini API pricing and free-tier terms](https://ai.google.dev/gemini-api/docs/pricing) for quota and data handling details.

The navigation includes **How the inputs work** at `/input-demo.html`. You can continue to paste sample records, or use the unpacked Chrome extension in `extension/` to collect from a site you are authorized to inspect. The extension looks for a published cookie declaration on the current page or linked same-site policy pages, reads value-free Chrome cookie metadata and the Cookiebot SDK snapshot, then sends the three inputs to the local app. It does not call Cookiebot's private Data API, and no Cookiebot API key or account access is needed. The input page displays the records, builds the guest roster, and lets you open it as a home scenario.

### Collect from a site with a public declaration

1. Start the app with `npm start` and open the target website in Chrome. Cookiebot's SDK is optional: without it, the extension sends an unreadable CMP snapshot and still collects the other available inputs.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this repository's `extension` folder.
3. Click the Cookie Homes extension. Choose **Find public declaration**. The extension checks the active page, cookie/privacy links on that site, and common policy paths. If needed, enter a same-site declaration URL in the optional field.
4. Choose **Grant access and collect**. Chrome asks for access to the active site and up to 24 provider domains listed in the declaration. The extension removes Chrome cookie values before sending data to the local app.
5. The app opens `/input-demo.html` with the collected inputs. Review the roster, choose **Build guest roster**, then **Open this generated home in the privacy journey**.

The declaration is a public inventory, not a live report of every cookie set during the current page load; it may also be absent or out of date. Chrome may not contain declared cookies because they are blocked, expired, partitioned, or not yet set. Provider-domain access is limited to 24 domains per collection. If no declaration is found, browser metadata and the SDK snapshot are still collected, while cookies without purpose evidence remain unclassified. A public declaration only describes cookies included in that declaration; it does not establish that a cookie was actually set by the current visit. The local handoff token expires after five minutes and is single-use. This prototype server has no user authentication; keep it local and do not expose it to a network.

The normalization code in `src/engine/cookiebot-adapter.js` translates Chrome Cookie records, Cookiebot SDK category choices, and public declaration rows into the existing guest contract. `src/engine/input-adapter.js` turns recognized purposes into guest analogies and gives unmatched cookies a metadata-based uncertainty prompt. The user can accept or reject an unknown-purpose guest for that home, but cannot save that decision as an all-home preference. Cookiebot provides category-level consent, so the SDK cannot reveal a separate choice for each cookie. When a declaration omits per-cookie domains, the adapter matches only an unambiguous cookie name; unresolved or duplicate matches remain unclassified instead of being treated as confirmed purpose data.

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

The AI proposes structured intent; it does not move guests. The rule engine rejects unsupported categories and decisions, essential cookies cannot be changed, and ambiguous replies apply no preference. An unclassified guest is included in the chat context and can be accepted or rejected by its exact ID for the current home, letting the user make an explicit choice despite uncertainty; that choice cannot be saved as an all-home category. Follow-up scenes are conversational scaffolding: they clarify an existing request and do not themselves create a guest or grant permission.

The live input path is separate from chat interpretation:

```text
Chrome extension ── browser metadata + Cookiebot SDK snapshot ──┐
                                                               ├─ cookiebot-adapter → input-demo review → home scenario
Public declaration page ─── cookie names + purpose/category ────┘
```

The extension reads the public declaration page and gathers the browser and SDK records. The local server only provides a short-lived `POST /api/input-scenarios` handoff; it removes cookie values from the scenario payload and binds only to `localhost`.

## Realistic project scope

This is a small, scenario-based preference elicitation prototype, not a reliable privacy profile extractor or a browser cookie manager. Its useful research question is whether contextual natural-language prompts help users express explicit choices, and how often the interpreter maps those choices correctly or asks for clarification. The unpacked extension can read metadata from an authorized live tab, but a public declaration can be stale, browser storage does not prove which page set a cookie, and purpose matching can be ambiguous. Test ambiguous, mixed, contradictory, and out-of-scope replies with participants, and compare the extracted choices with a direct preference questionnaire before claiming improved accuracy or usability.

The Gemini-backed chat requires an API key and network access. User messages, recent conversation turns, and current pending guest descriptions are sent to Google's Gemini API from the local server. Do not use sensitive personal data in this prototype; check provider terms and institutional research requirements before participant testing. The deterministic state engine can still be tested without an API key.

## Useful next steps for the project

1. Test natural, mixed, vague, and contradictory phrases with classmates. Track incorrect category mappings and cases where the AI should ask a follow-up.
2. Add a review/undo step before applying decisions if user testing finds incorrect interpretations hard to recover from.
3. For a production or public demo, add rate limiting, avoid sending unnecessary conversation history, and document the AI provider's data handling.
4. Later, replace the Gemini adapter in `server.js` with a local model or another provider if local-only processing is a project requirement.

## Project structure

- `server.js` - static server and server-side Gemini API proxy, including clarification schema validation
- `extension/` - unpacked Chrome MV3 popup connector for the active site
- `input-demo.html`, `input-demo.css`, `src/ui/input-demo.js` - interactive metadata/CMP input editor and generated guest roster
- `src/engine/cookiebot-adapter.js` - Chrome + Cookiebot source normalization
- `src/engine/input-adapter.js` - normalized metadata + CMP + purpose-catalog to guest adapter
- `src/engine/model.js` - state model and categories
- `src/engine/rules.js` - deterministic `enterHome`, `applyIntent`, and validation
- `src/data/scenarios.js` - hand-authored home stories and guest requests
- `src/ui/app.js` - one-note-per-home conversation, adaptive scenario display, choice progress, outcome recap, and game rendering
- `test/rules.test.js` - deterministic rule engine tests (`npm test`)
