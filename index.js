/**
 * Host half of dsh-skill-dashboard.
 *
 * This file owns IO and host services only: read the catalog, read the
 * taxonomy, hand both to the pure composer, serve the result. Everything the
 * dashboard *decides* (situations, inference, counts) lives in lib/compose.js
 * so it can be tested without a host.
 *
 * Primary source is `sessionSkillCatalog`, the host service behind the UI's
 * own skill menu: it lists the user-invocable skills of ONE session
 * composition, so user skills, project skills, bundled skills and the
 * runtime-registered (registry, no file) ones all appear together — the same
 * set the model sees, without activating a cold Agent.
 */

import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { composeDashboard } from './lib/compose.js'
import { summarizeAvailability } from './lib/capabilities.js'
import { tallySkillUsage } from './lib/usage.js'

export const name = 'dsh-skill-dashboard'

export const inject = ['webServer']

const ROUTE_PATH = '/api/skill-dash/data'
const ZH_PATH = '/api/skill-dash/zh'
const DIAG_PATH = '/api/skill-dash/diagnose'
const USAGE_PATH = '/api/skill-dash/usage'
const CLASSIFY_PATH = '/api/skill-dash/classify'
const EXCLUDE_PATH = '/api/skill-dash/exclude'
const OVERRIDE_PATH = '/api/skill-dash/override'
const OVERRIDE_IMPORT_PATH = '/api/skill-dash/override/import'
const TAXONOMY_URL = new URL('./taxonomy.json', import.meta.url)

const FALLBACK_TAXONOMY = {
  version: 0,
  situations: [{ id: 'other', title: '其他', titleEn: 'Other', order: 999 }],
  skills: {},
}

let taxonomyCache = { mtimeMs: -1, data: null }

async function loadTaxonomy() {
  try {
    const info = await stat(TAXONOMY_URL)
    if (taxonomyCache.data !== null && info.mtimeMs === taxonomyCache.mtimeMs) {
      return taxonomyCache.data
    }
    const raw = await readFile(TAXONOMY_URL, 'utf8')
    const data = JSON.parse(raw)
    taxonomyCache = { mtimeMs: info.mtimeMs, data }
    return data
  } catch (error) {
    console.warn('skill-dashboard: taxonomy unavailable, falling back', error)
    return taxonomyCache.data ?? FALLBACK_TAXONOMY
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

/**
 * The user's own override table. Absent is normal — no note. Unreadable or
 * malformed is ignored, and the note reaches the Client so the user is told
 * instead of silently wondering why their edit did nothing.
 */
async function loadOverride() {
  const file = overrideFile()
  try {
    const raw = await readFile(file, 'utf8')
    return { data: JSON.parse(raw), file, note: '' }
  } catch (error) {
    if (error && error.code === 'ENOENT') return { data: null, file, note: '' }
    return { data: null, file, note: `覆盖表读取失败，已忽略：${error?.message ?? error}` }
  }
}

function overrideFile() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skill-dashboard', 'taxonomy.json')
}

/** Names the user asked to keep out of the usage numbers. */
function excludeOf(override) {
  const list = override !== null && typeof override === 'object' && Array.isArray(override.data?.exclude) ? override.data.exclude : []
  return new Set(list.filter((name) => typeof name === 'string' && name !== ''))
}

function omitExcluded(map, excluded) {
  if (excluded.size === 0) return map ?? {}
  const out = {}
  for (const [key, value] of Object.entries(map ?? {})) if (!excluded.has(key)) out[key] = value
  return out
}

function countExcluding(byName, excluded) {
  let total = 0
  for (const [key, value] of Object.entries(byName ?? {})) if (!excluded.has(key)) total += value
  return total
}

/**
 * Wrap a bytes-in/JSON-out writer. Every mutating route is POST + JSON body,
 * and one place reading the body keeps the handlers about their own job.
 */
function postJson(handler) {
  return async (req, res) => {
    const reply = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' })
      res.end()
      return
    }
    let body
    try {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch (error) {
      reply(400, { ok: false, error: 'invalid JSON body' })
      return
    }
    try {
      const result = await handler(body)
      reply(result.status ?? 200, result.body)
    } catch (error) {
      reply(500, { ok: false, error: String(error?.message ?? error) })
    }
  }
}

/**
 * Record one skill's situation in the user's override table. Read-modify-write
 * through a temp file so a crash cannot leave half a table behind; everything
 * the user already wrote keeps its place.
 */
async function writeOverride(name, situation) {
  return writeOverrides([name], situation)
}

/** Assign several skills in one read-modify-write, so a batch is atomic. */
async function writeOverrides(names, situation) {
  const file = overrideFile()
  await mkdir(dirname(file), { recursive: true })

  let data = {}
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed
  } catch (error) {
    data = {}
  }

  const skills = data.skills !== null && typeof data.skills === 'object' && !Array.isArray(data.skills) ? data.skills : {}
  for (const name of names) {
    const previous = skills[name] !== null && typeof skills[name] === 'object' && !Array.isArray(skills[name]) ? skills[name] : {}
    skills[name] = { ...previous, situation }
  }
  data.skills = skills

  const temporary = `${file}.tmp`
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await rename(temporary, file)
  return file
}

/** Replace the whole override table (import). */
async function writeRawOverride(data) {
  const file = overrideFile()
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.tmp`
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await rename(temporary, file)
  return file
}

/** Add or remove one skill from the exclude list, keeping everything else. */
async function writeExclude(name, excluded) {
  const file = overrideFile()
  await mkdir(dirname(file), { recursive: true })

  let data = {}
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed
  } catch (error) {
    data = {}
  }

  const current = Array.isArray(data.exclude) ? data.exclude.filter((entry) => typeof entry === 'string') : []
  const next = excluded ? [...new Set([...current, name])] : current.filter((entry) => entry !== name)
  if (next.length === 0) delete data.exclude
  else data.exclude = next

  const temporary = `${file}.tmp`
  await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8')
  await rename(temporary, file)
  return file
}

function fromEntry(entry) {
  const path = entry.path ?? ''
  return {
    name: entry.name,
    description: entry.description ?? '',
    whenToUse: entry.whenToUse ?? '',
    source: entry.source ?? (path ? 'file' : 'registry'),
    provider: entry.provider ?? '',
    path,
    modelInvocable: entry.modelInvocable !== false,
    userInvocable: true,
  }
}

function fromSummary(summary) {
  const invocation = summary.invocation ?? {}
  return {
    name: summary.name,
    description: summary.description ?? '',
    whenToUse: summary.whenToUse ?? '',
    source: summary.source ?? 'unknown',
    provider: summary.provider ?? '',
    path: summary.path ?? '',
    modelInvocable: invocation.modelInvocable !== false,
    userInvocable: invocation.userInvocable !== false,
  }
}

function titleOf(meta) {
  if (meta === null || typeof meta !== 'object') return ''
  const title = meta.title
  if (typeof title === 'string') return title
  if (title !== null && typeof title === 'object') return title.en ?? title['zh-CN'] ?? ''
  return ''
}

/**
 * Plugin health straight from the manager: which rows are loading, active,
 * failed or switched off. A row without a fiber phase is not a running plugin
 * (a tool row, for instance), so it is counted but never as active.
 */
async function readPlugins(ctx) {
  try {
    const manager = ctx.get('pluginManager')
    if (manager === undefined || typeof manager.listPlugins !== 'function') return null
    const rows = await manager.listPlugins()
    if (!Array.isArray(rows)) return null
    const failed = rows.filter((row) => row.fiberPhase === 'failed' || Boolean(row.diagnostic))
    return {
      total: rows.length,
      active: rows.filter((row) => row.fiberPhase === 'active').length,
      failed: failed.length,
      disabled: rows.filter((row) => row.enabled === false).length,
      disabledNames: rows
        .filter((row) => row.enabled === false)
        .slice(0, 50)
        .map((row) => ({
          name: titleOf(row.meta) || row.moduleName || String(row.entryId),
          moduleName: row.moduleName || '',
        })),
      failedNames: failed.slice(0, 20).map((row) => ({
        name: titleOf(row.meta) || row.moduleName || String(row.entryId),
        moduleName: row.moduleName || '',
        phase: row.fiberPhase ?? null,
        diagnostic: String(row.diagnostic ?? row.meta?.error ?? ''),
      })),
    }
  } catch (error) {
    console.warn('skill-dashboard: plugin inventory unavailable', error)
    return null
  }
}

/**
 * Skill calls in ONE live session, read from the session the host already
 * holds in memory. No log scan, no persistence read: `ownEvents()` is the
 * live event list this process is already keeping.
 */
function readUsage(ctx, sessionId, excluded = new Set()) {
  try {
    if (!sessionId) return null
    const sessions = ctx.get('sessions')
    const session = sessions?.get?.(sessionId)
    if (!session) return null
    // `ownEvents()` is only what this process appended; after a restart the
    // history is inherited, so count the whole log instead.
    const events =
      typeof session.snapshotEvents === 'function' ? session.snapshotEvents() : typeof session.ownEvents === 'function' ? session.ownEvents() : []
    const tally = tallySkillUsage(events)
    return {
      sessionId,
      total: countExcluding(tally.byName, excluded),
      byName: omitExcluded(tally.byName, excluded),
      lastByName: omitExcluded(tally.lastByName, excluded),
      namedByName: omitExcluded(tally.namedByName, excluded),
      excluded: [...excluded],
    }
  } catch (error) {
    console.warn('skill-dashboard: usage unavailable', error)
    return null
  }
}

function reportOf({ plugins, capabilities, taxonomy, counts, language }) {
  const zh = String(language || '').toLowerCase().startsWith('zh')
  const lines = []
  lines.push(zh ? 'DSH 技能上手台 · 诊断报告' : 'DSH skill dashboard — diagnostics')
  lines.push(zh ? `时间：${new Date().toISOString()}` : `Time: ${new Date().toISOString()}`)
  lines.push('')
  if (plugins) {
    lines.push(
      zh
        ? `插件：${plugins.total} 行 / ${plugins.active} 活跃 / ${plugins.failed} 失败 / ${plugins.disabled} 停用`
        : `Plugins: ${plugins.total} rows / ${plugins.active} active / ${plugins.failed} failed / ${plugins.disabled} disabled`,
    )
    if (plugins.failed > 0) {
      lines.push(zh ? '失败插件：' : 'Failed:')
      for (const plugin of plugins.failedNames) {
        lines.push(`  - ${plugin.name} (${plugin.moduleName || '?'}, ${plugin.phase || '?'})`)
        if (plugin.diagnostic) lines.push(`    ${plugin.diagnostic.replace(/\n/g, '\n    ')}`)
      }
    }
  } else {
    lines.push(zh ? '插件：拿不到列表（pluginManager 不可用）' : 'Plugins: unavailable (no pluginManager)')
  }
  if (capabilities) {
    const missing = capabilities.missing.map((cap) => (zh ? cap.label : cap.labelEn))
    lines.push(zh ? `宿主能力：${missing.length === 0 ? '齐全' : '缺 ' + missing.join('、')}` : `Capabilities: ${missing.length === 0 ? 'all present' : 'missing ' + missing.join(', ')}`)
  }
  if (counts) {
    lines.push(
      zh
        ? `技能：${counts.total} 个（需点名 ${counts.manual}，有文件 ${counts.files}，注册表 ${counts.registry}，未收录 ${counts.unmapped}）`
        : `Skills: ${counts.total} (manual-only ${counts.manual}, on disk ${counts.files}, registry ${counts.registry}, unmapped ${counts.unmapped})`,
    )
  }
  if (taxonomy) {
    lines.push(
      zh
        ? `归类表：v${taxonomy.version}，${taxonomy.situations} 个处境，${taxonomy.skills} 条映射`
        : `Taxonomy: v${taxonomy.version}, ${taxonomy.situations} situations, ${taxonomy.skills} mappings`,
    )
  }
  return lines.join('\n')
}

export function apply(ctx) {
  const server = ctx.get('webServer')
  if (server === undefined) {
    console.warn('skill-dashboard: webServer unavailable, no route registered')
    return
  }

  const currentSessionId = () => {
    try {
      const sessions = ctx.get('sessions')
      const list = sessions?.list?.()
      if (Array.isArray(list) && list.length > 0) {
        const last = list[list.length - 1]
        return typeof last?.id === 'string' ? last.id : ''
      }
      return ''
    } catch (error) {
      return ''
    }
  }

  const readCatalog = async (url, signal) => {
    const sessionId = url.searchParams.get('session') || currentSessionId()
    const skills = ctx.get('skills')
    const notes = []

    if (sessionId) {
      const catalog = ctx.get('sessionSkillCatalog')
      if (catalog !== undefined) {
        try {
          const value = await catalog.list({ sessionId }, signal)
          const items = (value?.skills ?? []).map(fromEntry)
          if (items.length > 0) return { items, via: 'catalog' }
          notes.push('catalog empty')
        } catch (error) {
          notes.push('catalog: ' + String(error?.message ?? error))
        }
      } else {
        notes.push('no sessionSkillCatalog')
      }

      const sessions = ctx.get('sessions')
      if (skills !== undefined && sessions && typeof sessions.scope === 'function') {
        try {
          const scope = await sessions.scope(sessionId)
          if (scope) {
            const list = await skills.list({ scope })
            const items = list.map(fromSummary)
            if (items.length > 0) return { items, via: 'scoped', note: notes.join(' | ') }
            notes.push('scoped empty')
          }
        } catch (error) {
          notes.push('scoped: ' + String(error?.message ?? error))
        }
      }
    } else {
      notes.push('no session id')
    }

    if (skills === undefined) return { items: null, via: 'no-service', error: 'skills service unavailable' }
    const list = await skills.list({})
    return { items: list.map(fromSummary), via: 'global', note: notes.join(' | ') }
  }

  const handle = async (request) => {
    const url = new URL(request.url)
    const signal = request?.signal ?? new AbortController().signal
    const language = url.searchParams.get('lang') || ''
    const capabilities = summarizeAvailability({
      sessionSkillCatalog: ctx.get('sessionSkillCatalog') !== undefined,
      skills: ctx.get('skills') !== undefined,
      sessions: ctx.get('sessions') !== undefined,
      translator: ctx.get('translator') !== undefined,
    })

    let result
    try {
      result = await readCatalog(url, signal)
    } catch (error) {
      return json({ ok: false, error: String(error?.message ?? error), skills: [], capabilities }, 500)
    }

    const taxonomy = await loadTaxonomy()
    const override = await loadOverride()
    const sessionId = url.searchParams.get('session') || currentSessionId()
    const usage = readUsage(ctx, sessionId, excludeOf(override))

    if (result.items === null) {
      // Not an HTTP error: the page is reachable, it just has nothing to show.
      // The Client renders an explained empty state from `capabilities`.
      const composed = composeDashboard({ skills: [], taxonomy, override: override.data, language })
      return json({
        ok: true,
        via: 'none',
        note: result.note || '',
        generatedAt: Date.now(),
        taxonomyVersion: taxonomy.version ?? 0,
        overrideFile: override.file,
        overrideNote: override.note,
        capabilities,
        usage,
        problem: { code: 'no-catalog' },
        ...composed,
      })
    }

    const composed = composeDashboard({ skills: result.items, taxonomy, override: override.data, language })

    return json({
      ok: true,
      via: result.via,
      note: result.note || '',
      generatedAt: Date.now(),
      taxonomyVersion: taxonomy.version ?? 0,
      overrideFile: override.file,
      overrideNote: override.note,
      capabilities,
      usage,
      ...composed,
    })
  }

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: ROUTE_PATH,
      resource: async (request) => handle(request),
    }),
  )

  // On-the-spot Chinese for the manual-only skills. They are the ones a user
  // must name, so their description is the thing that has to be readable.
  // Anonymous providers (google/bing) need no session and no key; when the
  // host has no translator service this answers with an empty map.
  const zhCache = new Map()

  const handleZh = async (request) => {
    const url = new URL(request.url)
    const signal = request?.signal
    const translator = ctx.get('translator')
    if (translator === undefined) return json({ ok: true, zh: {}, skipped: 'translator unavailable' })

    let providers
    try {
      providers = await translator.availableProviders(signal)
    } catch (error) {
      return json({ ok: true, zh: {}, skipped: String(error?.message ?? error) })
    }
    if (!Array.isArray(providers) || providers.length === 0) {
      return json({ ok: true, zh: {}, skipped: 'no translation provider' })
    }

    const sessionId = url.searchParams.get('session') || currentSessionId()
    const free = providers.find((provider) => provider === 'bing' || provider === 'google')
    const provider = free ?? providers[0]
    const needsSession = free === undefined

    let result
    try {
      result = await readCatalog(url, signal)
    } catch (error) {
      return json({ ok: false, zh: {}, error: String(error?.message ?? error) }, 500)
    }

    const targets = (result.items ?? []).filter((item) => item.modelInvocable === false && item.description)
    const out = {}
    let skipped = ''
    const deadline = Date.now() + 7000

    for (const item of targets) {
      const text = String(item.description).slice(0, 400)
      if (zhCache.has(text)) {
        out[item.name] = zhCache.get(text)
        continue
      }
      if (Date.now() > deadline) {
        skipped = 'time budget'
        break
      }
      try {
        const spec = translator.resolve({
          text,
          targetLanguage: 'zh-CN',
          sourceLanguage: 'en',
          provider,
          ...(needsSession && sessionId ? { sessionId } : {}),
        })
        const translated = await translator.translate(spec, signal)
        if (typeof translated === 'string' && translated.trim() !== '') {
          zhCache.set(text, translated)
          out[item.name] = translated
        }
      } catch (error) {
        skipped = String(error?.message ?? error)
        break
      }
    }

    return json({ ok: true, zh: out, skipped })
  }

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: ZH_PATH,
      resource: async (request) => handleZh(request),
    }),
  )

  // Diagnostics are user-triggered: reading every plugin row and the whole
  // catalog is cheap but pointless on every panel open.
  const handleDiagnose = async (request) => {
    const url = new URL(request.url)
    const signal = request?.signal
    const language = url.searchParams.get('lang') || ''
    const plugins = await readPlugins(ctx)
    const taxonomy = await loadTaxonomy()
    const override = await loadOverride()
    const capabilities = summarizeAvailability({
      sessionSkillCatalog: ctx.get('sessionSkillCatalog') !== undefined,
      skills: ctx.get('skills') !== undefined,
      sessions: ctx.get('sessions') !== undefined,
      translator: ctx.get('translator') !== undefined,
    })

    let counts = null
    try {
      const catalog = await readCatalog(url, signal)
      if (catalog.items !== null) {
        counts = composeDashboard({ skills: catalog.items, taxonomy, override: override.data, language }).counts
      }
    } catch (error) {
      counts = null
    }

    const taxonomyInfo = {
      version: taxonomy.version ?? 0,
      situations: Array.isArray(taxonomy.situations) ? taxonomy.situations.length : 0,
      skills: taxonomy.skills !== null && typeof taxonomy.skills === 'object' ? Object.keys(taxonomy.skills).length : 0,
    }

    return json({
      ok: true,
      generatedAt: Date.now(),
      plugins,
      capabilities,
      taxonomy: taxonomyInfo,
      counts,
      text: reportOf({ plugins, capabilities, taxonomy: taxonomyInfo, counts, language }),
    })
  }

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: DIAG_PATH,
      resource: async (request) => handleDiagnose(request),
    }),
  )

  const readUsageAll = async (signal, excluded = new Set()) => {
    const query = ctx.get('sessionQuery')
    if (query === undefined || typeof query.listSessions !== 'function') {
      return { scope: 'all', error: 'sessionQuery unavailable', sessions: 0, available: 0, total: 0, byName: {}, partial: false }
    }

    const records = await query.listSessions(signal)
    const list = Array.isArray(records) ? records.slice(0, 30) : []
    const byName = {}
    const lastByName = {}
    const namedByName = {}
    let total = 0
    let scanned = 0
    const deadline = Date.now() + 8000

    for (const record of list) {
      if (Date.now() > deadline) break
      const id = record?.header?.id
      if (typeof id !== 'string' || id === '') continue
      try {
        let events = null
        const live = ctx.get('sessions')?.get?.(id)
        if (live !== undefined && typeof live.snapshotEvents === 'function') {
          events = live.snapshotEvents()
        } else if (typeof query.readSession === 'function') {
          events = (await query.readSession(id))?.events ?? null
        }
        if (!events) continue
        const tally = tallySkillUsage(events)
        total += tally.total
        for (const [name, count] of Object.entries(tally.byName)) byName[name] = (byName[name] ?? 0) + count
        for (const [name, time] of Object.entries(tally.lastByName ?? {})) {
          if (time > (lastByName[name] ?? 0)) lastByName[name] = time
        }
        for (const [name, count] of Object.entries(tally.namedByName ?? {})) {
          namedByName[name] = (namedByName[name] ?? 0) + count
        }
        scanned += 1
      } catch (error) {
        // One unreadable session must not abort the scan.
      }
    }

    return {
      scope: 'all',
      sessions: scanned,
      available: list.length,
      total: countExcluding(byName, excluded),
      byName: omitExcluded(byName, excluded),
      lastByName: omitExcluded(lastByName, excluded),
      namedByName: omitExcluded(namedByName, excluded),
      excluded: [...excluded],
      partial: scanned < list.length,
    }
  }

  const handleUsage = async (request) => {
    const url = new URL(request.url)
    const signal = request?.signal
    const scope = url.searchParams.get('scope') || 'session'
    const sessionId = url.searchParams.get('session') || currentSessionId()
    const override = await loadOverride()

    if (scope !== 'all') {
      const usage = readUsage(ctx, sessionId, excludeOf(override))
      return json({ ok: usage !== null, ...(usage ?? {}) })
    }

    try {
      const aggregated = await readUsageAll(signal, excludeOf(override))
      return json({ ok: true, ...aggregated })
    } catch (error) {
      return json({ ok: false, error: String(error?.message ?? error) }, 500)
    }
  }

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: USAGE_PATH,
      resource: async (request) => handleUsage(request),
    }),
  )

  // A resource route answers GET/HEAD only, so the write uses a Node handler
  // and reads its own body.
  const handleClassify = postJson(async (body) => {
    const single = typeof body?.name === 'string' ? body.name.trim() : ''
    const list = Array.isArray(body?.names) ? body.names.filter((entry) => typeof entry === 'string' && entry.trim() !== '').map((entry) => entry.trim()) : []
    const names = list.length > 0 ? [...new Set(list)] : single === '' ? [] : [single]
    const situation = typeof body?.situation === 'string' ? body.situation.trim() : ''
    if (names.length === 0) return { status: 400, body: { ok: false, error: 'name or names is required' } }

    const taxonomy = await loadTaxonomy()
    const situations = Array.isArray(taxonomy.situations) ? taxonomy.situations : []
    if (!situations.some((entry) => entry.id === situation)) {
      return { status: 400, body: { ok: false, error: `unknown situation: ${situation}` } }
    }

    const file = await writeOverrides(names, situation)
    return { body: { ok: true, names, situation, file } }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: CLASSIFY_PATH,
      handler: handleClassify,
    }),
  )

  const handleExclude = postJson(async (body) => {
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    if (name === '') return { status: 400, body: { ok: false, error: 'name is required' } }
    const file = await writeExclude(name, body?.excluded === true)
    return { body: { ok: true, name, excluded: body?.excluded === true, file } }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: EXCLUDE_PATH,
      handler: handleExclude,
    }),
  )

  // The override table is the user's own data: export it, hand it to someone
  // else, or paste theirs in.
  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: OVERRIDE_PATH,
      resource: async () => {
        const override = await loadOverride()
        return json({ ok: true, file: override.file, note: override.note, data: override.data })
      },
    }),
  )

  const handleImport = postJson(async (body) => {
    const data = body?.data
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      return { status: 400, body: { ok: false, error: 'data must be an object' } }
    }
    if (data.skills !== undefined && (data.skills === null || typeof data.skills !== 'object' || Array.isArray(data.skills))) {
      return { status: 400, body: { ok: false, error: 'data.skills must be an object' } }
    }
    if (data.exclude !== undefined && !Array.isArray(data.exclude)) {
      return { status: 400, body: { ok: false, error: 'data.exclude must be an array' } }
    }
    const file = await writeRawOverride(data)
    return { body: { ok: true, file, skills: Object.keys(data.skills ?? {}).length, exclude: (data.exclude ?? []).length } }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: OVERRIDE_IMPORT_PATH,
      handler: handleImport,
    }),
  )
}
