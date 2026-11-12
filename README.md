English | [简体中文](README.zh-CN.md)

# dsh-skill-dashboard

A [DeepSeek Harness](https://github.com/deepseek-ai) plugin that adds a **Skills** tab to the right sidebar: every installed skill in one list, the manual-only ones marked, and their trigger phrase one click away.

## Why this exists

Skills are spread across `~/.dsh/skills`, project `.dsh/skills`, plugin bundles and the runtime registry, so it is easy to lose track of what is actually installed.

A skill declared with `disable-model-invocation: true` is deliberately kept out of the model's catalog. The model cannot call it, and an attempt fails with `skill "..." is not available for model invocation`. Only a user who knows the exact name can invoke it, and nothing in the UI tells you that name.

The dashboard indexes both cases.

## Features

- **One list of every skill**, grouped by what you are trying to do (write code, review, documentation, research, design, learn, maintain the harness) instead of by which repository it came from.
- **Manual-only skills are marked** with a badge and a trigger phrase. Insert appends the phrase to the composer without sending it and without overwriting a draft.
- **Search and filters**: name or description, manual-only, on-disk, registry-only.
- **Origin per skill**: the repository URL when the taxonomy knows it, the file path otherwise, copyable.
- **Live catalog**: read from the host's session skill catalog, so user, project, bundled and registry skills all appear; a skill installed later shows up within 30 seconds.
- **Reclassify from the UI**: move a skill to another situation; the choice is written to your user override file, not the package.
- **Diagnostics on demand**: a copyable plain-text report on plugin health, produced only when you ask for it.
- **Usage**: the top skills of the current session with call counts, how many were never called, and an opt-in scan across recent sessions.
- **Localised UI**: English by default, Chinese when the host is Chinese.

## Requirements

| Requirement | Notes |
| --- | --- |
| DSH | `>=0.2.2-rc.1`, declared in `engines.dsh` and `dsh.compatibility`. Newer builds are not blocked. |
| Node.js | 20 or newer. CI runs 22. |
| Right sidebar | `@deepseek-ai/dsh-client-ui-sidebar-right`, included in the default web profile. |

## Installation

From a local checkout:

```js
plugin_manager({ action: 'install_bundle', target: 'D:/path/to/dsh-skill-dashboard' })
```

From npm, once the package is published:

```js
plugin_manager({ action: 'install_bundle', target: 'dsh-skill-dashboard' })
```

Reload the window after the bundle is enabled.

## Usage

Open **Skills** from the session header, or from the right sidebar: `+` → guide → Skills.

- Type in the search box to filter by name or description.
- Use the filter chips to narrow the list to manual-only, on-disk or registry-only skills.
- On a manual-only card, **Insert** appends the trigger phrase to the composer.
- **Reclassify** moves a skill to another situation and saves the choice to your override file.
- **Run diagnostics** collects plugin health into a report you can paste into an issue.
- **Calls** shows usage for this session; switch to all sessions for a wider scan.

## Configuration

### Packaged taxonomy

Grouping, situation titles and trigger phrases live in [`taxonomy.json`](taxonomy.json). It is plain data; changing it does not require a rebuild.

```json
{
  "situations": [{ "id": "code", "title": "写代码", "titleEn": "Write code", "order": 10 }],
  "skills": {
    "tdd": { "situation": "code" },
    "handoff": { "situation": "docs", "trigger": "use handoff to write the handoff doc" }
  }
}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `situations[].title` / `titleEn` | yes | Chinese and English group titles |
| `skills.<name>.situation` | yes | Which group the skill belongs to |
| `skills.<name>.trigger` | no | Phrase inserted into the composer; generated from the description when absent |
| `skills.<name>.zh` | no | Chinese description shown in a Chinese UI |
| `skills.<name>.repo` | no | Turns the origin line into a copyable repository URL |

A skill that is not listed still appears: it is inferred from its name and description and sorted automatically, or placed under **Other** when nothing matches.

```bash
node tools/check-taxonomy.mjs   # validates the file; CI runs it too
```

### User override

Put a file of the same shape at `$DSH_HOME/skill-dashboard/taxonomy.json` (default `~/.dsh/skill-dashboard/taxonomy.json`). It is layered over the packaged table per skill, so you can regroup your own skills without editing the package.

```json
{ "skills": { "my-deploy-helper": { "situation": "harness" } } }
```

An override can add situations and change skills; it cannot delete a packaged entry. A malformed file is ignored, and the dashboard shows a notice instead of going blank. Reclassify in the UI writes to this file.

## How it works

The plugin has two halves. `index.js` runs in the host and registers HTTP routes. `client.js` runs in the browser, registers the sidebar tab and renders it. The data-shaping logic is a pure function in `lib/compose.js` so it can be tested without a host.

| Route | Purpose |
| --- | --- |
| `GET /api/skill-dash/data` | Skill catalog merged with the taxonomy |
| `GET /api/skill-dash/zh` | Chinese descriptions for the current catalog |
| `GET /api/skill-dash/diagnose` | Plugin health report |
| `GET /api/skill-dash/usage` | Skill call counts for one session or all sessions |
| `POST /api/skill-dash/classify` | Write a classification into the user override |
| `POST /api/skill-dash/exclude` | Exclude a skill from the usage statistics |

## Compatibility

- **Platforms**: Windows, macOS and Linux. The plugin contains no platform-specific code; it has been exercised on Windows only.
- **DSH versions**: every host capability is probed at runtime. A missing capability produces an empty state that names what is missing, rather than a blank panel.
- No telemetry. The plugin does not report usage anywhere.

## Non-goals

This plugin is **read-only by design**: it does not install, uninstall, update, enable or disable skills. See [ADR 0001](docs/adr/0001-read-only-by-design.md). It also does not browse skills you have not installed.

## Development

```bash
npm run check   # syntax, taxonomy, package contents, tests
npm test        # node --test only
```

`npm run check` is what CI runs in [`.github/workflows/check.yml`](.github/workflows/check.yml).

After editing `index.js`, reload the bundle (`plugin_manager` disable, then enable): HMR does not re-import the host module. After editing `client.js`, reload the page.

### Releasing

The first release needs a human for GitHub credentials, the push and the npm login. The wizard walks through it one stage at a time:

```bash
bash scripts/publish-wizard.sh
```

## Contributing

Issues and feature requests go to [GitHub Issues](https://github.com/chandlernoidea/dsh-skill-dashboard/issues). Pull requests are welcome.

- Keep taxonomy changes in JSON; JavaScript changes need a test under `test/`.
- Run `npm run check` before opening a pull request.
- CI must pass.

## License

MIT. See [LICENSE](LICENSE).
