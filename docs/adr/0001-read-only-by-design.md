# 0001 — Read-only by design

**Status**: accepted (2026-11-11)

## Context

A DSH installation can already gain skills from several places: `@michengai/dsh-skills-manager` installs from ClawHub, skills.sh and arbitrary Git repositories, keeps provenance, and supports diff-previewed updates with backup rollback. `@linxin666/dsh-client-ui-skill-explorer` browses, enables, disables and imports local skills. A full skill manager therefore already exists, twice.

The dashboard's own premise is narrower: people do not know **which** skills they have, and they do not know **how to ask for** the ones that never enter the model's catalog.

## Decision

`dsh-skill-dashboard` never writes to a skill directory. It lists, groups, explains, and copies or inserts the phrase that names a skill. Installation stays with the tools that already own it.

## Consequences

- No install UI, no uninstall, no update flow, no version handling of skills in this plugin.
- The card shows where a skill came from (repo URL when `taxonomy.json` carries one, its path otherwise) so a user can move it to another machine by hand.
- Duplicate implementations of "install" cannot drift apart, because there is only one.
- If in-app installation ever becomes necessary, it should delegate to `dsh-skills-manager` rather than reimplement it — a change of this decision, not an extension of it.
