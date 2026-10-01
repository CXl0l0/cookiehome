# Cookie Homes (CP4106)

Gamified privacy preference extraction. Websites are homes, third parties are guests, cookies are information.

**Week 7 scope:** deterministic core, basic interface, initial state model. No AI yet.

```
Natural Language -> AI Interpretation -> Structured Intent -> Deterministic Rules -> Game State
   (Week 8)            (Week 8)           (schema ready)         (done)              (done)
```

## Run
```
npm start        # http://localhost:3000  (needs Node 18+)
npm test         # rule engine tests
```

## Structure
- `src/engine/model.js` - state model, categories
- `src/engine/rules.js` - pure rule engine: `enterHome`, `applyIntent`, `validateIntent`
- `src/data/scenarios.js` - homes and guests (add new scenarios here only)
- `src/ui/app.js` - buttons produce intents; Week 8 replaces them with chat + AI
