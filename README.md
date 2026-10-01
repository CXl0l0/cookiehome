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

## Week 8 interaction path

```text
Chat message -> POST /api/chat -> structured AI decisions -> validate/applyIntent -> visible house state
```

The server asks the Gemini generateContent API for a JSON response matching a schema containing a short reply, an ambiguity flag, and zero or more `{ category, decision, scope }` decisions. Ambiguous input produces a clarifying question and no game changes. Clear input goes through `applyIntent`; the model cannot directly modify game state. `scope` defaults to `this_home`; the AI uses `all_homes` only when the user explicitly asks for a lasting preference.

## Useful next steps for the project

1. Test natural, mixed, vague, and contradictory phrases with classmates. Track incorrect category mappings and cases where the AI should ask a follow-up.
2. Add a review/undo step before applying decisions if user testing finds incorrect interpretations hard to recover from.
3. For a production or public demo, add rate limiting, avoid sending unnecessary conversation history, and document the AI provider's data handling.
4. Later, replace the Gemini adapter in `server.js` with a local model or another provider if local-only processing is a project requirement.

## Project structure

- `server.js` - static server and server-side Gemini API proxy
- `src/engine/model.js` - state model and categories
- `src/engine/rules.js` - deterministic `enterHome`, `applyIntent`, and validation
- `src/data/scenarios.js` - homes and guests
- `src/ui/app.js` - conversation interface and game rendering
- `test/rules.test.js` - deterministic rule engine tests (`npm test`)
