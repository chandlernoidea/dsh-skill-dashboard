# 0002 — Model translation is opt-in

**Status**: accepted (2026-11-12)

## Context

Many skills ship an English description. A beginner who cannot tell what a
skill does will not use it, and the dashboard's job is to make skills usable
without reading the whole catalog. DSH exposes two host services that make an
in-plugin translation possible: `ctx.agents.get(sessionId).model.current()`
returns the model the user selected for that Session, and `ctx.llm.stream()`
is the only supported path to a provider.

That path sends text to the user's configured provider and spends their
tokens. Skill descriptions are local files, and a Skill may describe internal
tooling, so this is a privacy boundary as well as a cost boundary.

## Decision

Model translation is a **per-action, opt-in** feature:

- Nothing is translated on page load, on a timer, or as a side effect of any
  other request.
- The Client shows a consent panel with the number of skills, the estimated
  characters, and the provider/model. Only its confirm button sends
  `consent: true`; the Host rejects every translate request without it.
- Only `name`, `description` and `whenToUse` are sent. No conversation, tool
  output, file contents, session ids or logs. The model returns description
  translations only; the skill name is never changed (it is what the user
  types).
- The route uses the model already selected in the Session; it does not pick a
  model on the user's behalf.
- The first confirmation can be remembered in the web client; a remembered
  choice turns the next click into one request, but the consent panel is still
  the only way to enable it.
- The action is only offered in the Chinese UI. Cards use the Chinese
  description only in that locale, so offering it in an English UI would spend
  tokens on text the user never sees.
- At most 24 skills per request, 8 per model call, 30 s total; a non-`stop`
  finish or unparseable output is an error and is not cached.
- Successful translations are cached by a hash of the exact source text in
  `~/.dsh/skill-dashboard/translations.json`, so an unchanged description is
  never paid for twice.

## Consequences

- The feature is useless until the user confirms; that is intended.
- Translation quality is whatever the selected model produces; the plugin does
  not run a second model to check it.
- The cache is disposable: deleting the file only means the next translation
  costs tokens again.
- The free `translator` route remains as a fallback when the host has an
  anonymous provider; it does not write the model cache.
- No skill directory is modified, so ADR 0001 still holds.

## Alternatives rejected

- **Translate on load**: surprise token spend and a silent privacy leak.
- **Send descriptions to a third-party service**: leaves the local model
  boundary and adds a vendor dependency.
- **Rewrite `SKILL.md` with the translation**: writes to a skill directory,
  which ADR 0001 forbids.
