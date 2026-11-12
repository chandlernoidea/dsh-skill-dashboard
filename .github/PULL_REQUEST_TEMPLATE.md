## What changed

<!-- One or two sentences. Link the issue if there is one. -->

## Evidence

- [ ] `npm run check` passes
- [ ] If this changes the UI: refreshed the panel and checked both the Chinese and English locale
- [ ] If this calls a model: tested with a fake `llm.stream`; no real request in the test suite

## Boundaries

- [ ] Does not move, rewrite, enable or disable skill directories
- [ ] Writes only under `~/.dsh/skill-dashboard/`
- [ ] If this changes a hard-to-reverse decision, an ADR or `GLOSSARY.md` is updated

## Notes for the reviewer

<!-- Anything surprising, or a deliberate tradeoff. -->
