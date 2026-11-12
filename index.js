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

import { readFile, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { composeDashboard } from './lib/compose.js'
import { summarizeAvailability } from './lib/capabilities.js'
import { assignSituation, normalizeOverride, pruneOverride, readOverride, replaceOverride, restoreUndo, saveUndo, setExcluded, updateOverride } from './lib/override.js'
import {
  BATCH_SIZE,
  MAX_SKILLS,
  estimateChars,
  mergeTranslationCache,
  pendingSkills,
  readTranslationCache,
  forgetTranslations,
  sourceHash,
  translateBatch,
  translationsFor,
} from './lib/translate.js'
import { composeUsage, tallySkillUsage } from './lib/usage.js'
import { USAGE_CACHE_TTL_MS, readUsageCache, usageCacheKey, writeUsageCache } from './lib/usage-cache.js'
import { diffSkills, readSkillsSnapshot, writeSkillsSnapshot } from './lib/skills-snapshot.js'

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
const OVERRIDE_PRUNE_PATH = '/api/skill-dash/override/prune'
const OVERRIDE_PREVIEW_PATH = '/api/skill-dash/override/preview'
const OVERRIDE_UNDO_PATH = '/api/skill-dash/override/undo'
const TRANSLATE_PATH = '/api/skill-dash/translate'
const TRANSLATE_FORGET_PATH = '/api/skill-dash/translate/forget'
const SKILLS_ACK_PATH = '/api/skill-dash/skills/ack'
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
 *
 * Writes go through `lib/override.js`, which owns validation, serialisation
 * and the corrupt-file backup; read and write therefore agree on the shape.
 */
async function loadOverride() {
  return readOverride(overrideFile())
}

function overrideFile() {
  return join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skill-dashboard', 'taxonomy.json')
}

/** Names the user asked to keep out of the usage numbers. */
function excludeOf(override) {
  const list = override !== null && typeof override === 'object' && Array.isArray(override.data?.exclude) ? override.data.exclude : []
  return new Set(list.filter((name) => typeof name === 'string' && name !== ''))
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
    return { sessionId, ...composeUsage([tallySkillUsage(events)], { excluded }) }
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

  const readCatalogFor = async (sessionId, signal) => {
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

  // One catalog read per request burst. `/data` and `/zh` fire together when
  // the panel opens; without this they each call the host catalog. The TTL is
  // short so an install is still visible within a couple of seconds.
  const catalogCache = new Map()
  const catalogInFlight = new Map()
  const CATALOG_TTL_MS = 500
  const readCatalogCached = async (sessionId) => {
    const key = sessionId || ''
    const hit = catalogCache.get(key)
    if (hit !== undefined && Date.now() - hit.at < CATALOG_TTL_MS) return hit.value
    const pending = catalogInFlight.get(key)
    if (pending !== undefined) return pending
    const request = readCatalogFor(sessionId, undefined)
      .then((value) => {
        catalogCache.set(key, { at: Date.now(), value })
        return value
      })
      .finally(() => {
        catalogInFlight.delete(key)
      })
    catalogInFlight.set(key, request)
    return request
  }
  const readCatalog = async (url) => readCatalogCached(url.searchParams.get('session') || currentSessionId())

  const capabilityReport = () => ({
    sessionSkillCatalog: ctx.get('sessionSkillCatalog') !== undefined,
    skills: ctx.get('skills') !== undefined,
    sessions: ctx.get('sessions') !== undefined,
    translator: ctx.get('translator') !== undefined,
    llm: ctx.get('llm') !== undefined,
    agents: ctx.get('agents') !== undefined,
  })

  // The model the user selected in this Session, used for opt-in translation.
  const sessionModel = (sessionId) => {
    try {
      const agent = ctx.get('agents')?.get?.(sessionId)
      const selection = agent?.model?.current?.()
      if (selection?.provider && selection?.model) return { provider: selection.provider, model: selection.model }
      if (agent?.options?.provider && agent?.options?.model) {
        return { provider: agent.options.provider, model: agent.options.model }
      }
    } catch (error) {
      /* no live agent: translation stays unavailable */
    }
    return null
  }

  const translationFile = () =>
    join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skill-dashboard', 'translations.json')

  const usageCacheFile = () =>
    join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skill-dashboard', 'usage-cache.json')

  const skillsSnapshotFile = () =>
    join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skill-dashboard', 'skills-snapshot.json')

  const handle = async (request) => {
    const url = new URL(request.url)
    const signal = request?.signal ?? new AbortController().signal
    const language = url.searchParams.get('lang') || ''
    const capabilities = summarizeAvailability(capabilityReport())

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
    const model = sessionModel(sessionId)
    const translationCache = await readTranslationCache(translationFile())

    // Compare against the snapshot the user last acknowledged. A first run (or
    // a corrupt snapshot) initializes it instead of reporting the whole
    // catalog as new; an empty catalog never advances it.
    let skillsChanges = { added: [], removed: [] }
    if (Array.isArray(result.items) && result.items.length > 0) {
      const snapshot = await readSkillsSnapshot(skillsSnapshotFile())
      if (snapshot === null) {
        try {
          await writeSkillsSnapshot(skillsSnapshotFile(), result.items)
        } catch (error) {
          // A failed snapshot only means no change markers this time.
        }
      } else {
        skillsChanges = diffSkills(snapshot, result.items)
      }
    }

    const translateInfoFor = (skills) => {
      const pending = pendingSkills((skills ?? []).filter((skill) => !skill.zh), translationCache).slice(0, MAX_SKILLS)
      return {
        available: Boolean(model) && ctx.get('llm') !== undefined,
        provider: model?.provider ?? '',
        model: model?.model ?? '',
        pending: pending.length,
        chars: estimateChars(pending),
        limit: MAX_SKILLS,
      }
    }

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
        model,
        zh: {},
        translate: translateInfoFor([]),
        skillsChanges,
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
      model,
      zh: translationsFor(composed.skills, translationCache),
      translate: translateInfoFor(composed.skills),
      skillsChanges,
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
    const capabilities = summarizeAvailability(capabilityReport())

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
      return {
        scope: 'all',
        available: false,
        error: 'sessionQuery unavailable',
        scanned: 0,
        sessionCount: 0,
        ...composeUsage([], { excluded }),
      }
    }

    let records
    try {
      records = await query.listSessions(signal)
    } catch (error) {
      return {
        scope: 'all',
        available: false,
        error: String(error?.message ?? error),
        scanned: 0,
        sessionCount: 0,
        ...composeUsage([], { excluded }),
      }
    }

    const list = Array.isArray(records) ? records.slice(0, 30) : []
    const key = usageCacheKey(list)
    const cached = await readUsageCache(usageCacheFile())
    if (cached !== null && cached.key === key && Date.now() - cached.at < USAGE_CACHE_TTL_MS) {
      return {
        scope: 'all',
        available: true,
        scanned: list.length,
        sessionCount: list.length,
        cached: true,
        ...composeUsage(cached.tallies, { excluded }),
      }
    }

    const tallies = []
    let scanned = 0
    let deadlineHit = false
    const deadline = Date.now() + 8000

    for (const record of list) {
      if (Date.now() > deadline) {
        deadlineHit = true
        break
      }
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
        tallies.push(tallySkillUsage(events))
        scanned += 1
      } catch (error) {
        // One unreadable session must not abort the scan.
      }
    }

    const partial = deadlineHit || scanned < list.length
    if (!partial) {
      try {
        await writeUsageCache(usageCacheFile(), key, tallies)
      } catch (error) {
        // The cache is best effort; a failed write must not fail the scan.
      }
    }
    return {
      scope: 'all',
      available: true,
      scanned,
      sessionCount: list.length,
      cached: false,
      ...composeUsage(tallies, { excluded, partial }),
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

    const result = await updateOverride(overrideFile(), (data) => assignSituation(data, names, situation))
    return { body: { ok: true, names, situation, file: result.file, ...(result.backup ? { backup: result.backup } : {}) } }
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
    const result = await updateOverride(overrideFile(), (data) => setExcluded(data, name, body?.excluded === true))
    return { body: { ok: true, name, excluded: body?.excluded === true, file: result.file, ...(result.backup ? { backup: result.backup } : {}) } }
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

  const sessionForBody = (body) =>
    typeof body?.session === 'string' && body.session !== '' ? body.session : currentSessionId()

  // PULSE-style "preview before apply", adapted to the read-only design: a
  // plan can only change the user's override table, never a skill file.
  const handlePreview = postJson(async (body) => {
    const normalized = normalizeOverride(body?.data)
    if (normalized === null) {
      return { status: 400, body: { ok: false, error: 'data must be an object' } }
    }
    if (normalized.problems.length > 0) {
      return { status: 400, body: { ok: false, error: normalized.problems.join('; ') } }
    }

    let catalog = { items: [] }
    try {
      catalog = await readCatalogCached(sessionForBody(body))
    } catch (error) {
      return { status: 500, body: { ok: false, error: String(error?.message ?? error) } }
    }

    const items = Array.isArray(catalog.items) ? catalog.items : []
    const taxonomy = await loadTaxonomy()
    const override = await loadOverride()
    const before = composeDashboard({ skills: items, taxonomy, override: override.data, language: '' })
    const after = composeDashboard({ skills: items, taxonomy, override: normalized.data, language: '' })
    const previous = new Map(before.skills.map((skill) => [skill.name, skill.situation]))
    const changes = after.skills
      .filter((skill) => previous.has(skill.name) && previous.get(skill.name) !== skill.situation)
      .map((skill) => ({ name: skill.name, from: previous.get(skill.name), to: skill.situation }))

    const beforeExclude = new Set(Array.isArray(override.data?.exclude) ? override.data.exclude : [])
    const afterExclude = new Set(Array.isArray(normalized.data.exclude) ? normalized.data.exclude : [])
    const excludeAdded = [...afterExclude].filter((name) => !beforeExclude.has(name))
    const excludeRemoved = [...beforeExclude].filter((name) => !afterExclude.has(name))

    return {
      body: {
        ok: true,
        changes,
        excludeAdded,
        excludeRemoved,
        counts: {
          situations: changes.length,
          excludeAdded: excludeAdded.length,
          excludeRemoved: excludeRemoved.length,
        },
      },
    }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: OVERRIDE_PREVIEW_PATH,
      handler: handlePreview,
    }),
  )

  const handleImport = postJson(async (body) => {
    const normalized = normalizeOverride(body?.data)
    if (normalized === null) {
      return { status: 400, body: { ok: false, error: 'data must be an object' } }
    }
    if (normalized.problems.length > 0) {
      return { status: 400, body: { ok: false, error: normalized.problems.join('; ') } }
    }
    const current = await loadOverride()
    await saveUndo(overrideFile(), current.data)
    const result = await replaceOverride(overrideFile(), normalized.data)
    return {
      body: {
        ok: true,
        file: result.file,
        skills: Object.keys(normalized.data.skills ?? {}).length,
        exclude: (normalized.data.exclude ?? []).length,
        undo: true,
      },
    }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: OVERRIDE_IMPORT_PATH,
      handler: handleImport,
    }),
  )

  // After a skill is uninstalled, its override row is dead weight. Prune only
  // the names the Host says disappeared; keep a one-level undo like an import.
  const handlePrune = postJson(async (body) => {
    const names = Array.isArray(body?.names)
      ? body.names.filter((name) => typeof name === 'string' && name !== '')
      : []
    if (names.length === 0) {
      return { status: 400, body: { ok: false, error: 'names required' } }
    }
    const current = await loadOverride()
    await saveUndo(overrideFile(), current.data)
    const result = await replaceOverride(overrideFile(), pruneOverride(current.data, names))
    return { body: { ok: true, file: result.file, removed: names.length, undo: true } }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: OVERRIDE_PRUNE_PATH,
      handler: handlePrune,
    }),
  )

  const handleUndo = postJson(async () => {
    const restored = await restoreUndo(overrideFile())
    if (restored === null) {
      return { status: 400, body: { ok: false, error: '没有可撤销的方案' } }
    }
    return { body: { ok: true, skills: Object.keys(restored.skills ?? {}).length } }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: OVERRIDE_UNDO_PATH,
      handler: handleUndo,
    }),
  )

  // "Got it": advance the snapshot so the change markers disappear until the
  // next install/removal. This is the only write that touches the snapshot.
  const handleSkillsAck = postJson(async (body) => {
    const sessionId = sessionForBody(body)
    const catalog = await readCatalogCached(sessionId)
    const items = Array.isArray(catalog.items) ? catalog.items : []
    if (items.length === 0) {
      return { status: 400, body: { ok: false, error: '技能目录为空，未更新快照' } }
    }
    await writeSkillsSnapshot(skillsSnapshotFile(), items)
    return { body: { ok: true, skills: items.length } }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: SKILLS_ACK_PATH,
      handler: handleSkillsAck,
    }),
  )

  // Opt-in translation. Nothing is sent on page load or on a timer: the body
  // must carry `consent: true`, which only the Client's confirmation panel
  // sends. One short request per batch, a hard cap, and a content-hash cache.
  const handleTranslate = postJson(async (body) => {
    if (body?.consent !== true) return { status: 400, body: { ok: false, error: 'consent required' } }
    const llm = ctx.get('llm')
    if (llm === undefined) return { status: 400, body: { ok: false, error: '模型服务不可用' } }

    const sessionId = typeof body?.session === 'string' && body.session !== '' ? body.session : currentSessionId()
    const target = sessionModel(sessionId)
    if (target === null) return { status: 400, body: { ok: false, error: '当前会话没有选中模型' } }

    // Translation is a simple task. Use the lowest reasoning effort the model
    // advertises; inheriting the session's "high" setting can spend the whole
    // output budget on reasoning and finish with max-tokens and no text.
    let reasoningEffort = ''
    try {
      const info = await llm.resolveModelInfo?.(target.provider, target.model)
      const efforts = info && info.reasoning && Array.isArray(info.reasoning.efforts) ? info.reasoning.efforts : []
      if (efforts.length > 0) {
        const rank = (id) =>
          /none|off|minimal|disable/i.test(id) ? 0 : /low/i.test(id) ? 1 : /medium/i.test(id) ? 2 : /high/i.test(id) ? 3 : 4
        const preferred = [...efforts].sort((a, b) => rank(a.id) - rank(b.id))[0]
        if (preferred && typeof preferred.id === 'string') reasoningEffort = preferred.id
      }
    } catch (error) {
      // Model metadata is advisory; without it the provider default applies.
    }

    let catalog = { items: [] }
    try {
      catalog = await readCatalogCached(sessionId)
    } catch (error) {
      return { status: 500, body: { ok: false, error: String(error?.message ?? error) } }
    }

    const items = Array.isArray(catalog.items) ? catalog.items : []
    const requested = Array.isArray(body?.names)
      ? new Set(body.names.filter((name) => typeof name === 'string' && name !== ''))
      : null
    const scoped = requested === null ? items : items.filter((item) => requested.has(item.name))
    const cache = await readTranslationCache(translationFile())
    const pending = pendingSkills(scoped, cache).slice(0, MAX_SKILLS)
    if (pending.length === 0) {
      return { body: { ok: true, zh: {}, translated: 0, skipped: 0, chars: 0, provider: target.provider, model: target.model } }
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timer = controller ? setTimeout(() => controller.abort(), 30000) : null
    const zh = {}
    let error = ''
    let consecutiveFailures = 0
    try {
      for (let index = 0; index < pending.length; index += BATCH_SIZE) {
        if (controller?.signal.aborted) {
          error = '翻译超时'
          break
        }
        const batch = pending.slice(index, index + BATCH_SIZE)
        try {
          const translated = await translateBatch({
            llm,
            target,
            sessionId,
            skills: batch,
            signal: controller?.signal,
            reasoningEffort,
          })
          Object.assign(zh, translated)
          consecutiveFailures = 0
          const additions = {}
          for (const item of batch) {
            if (translated[item.name]) additions[item.name] = { hash: sourceHash(item), zh: translated[item.name] }
          }
          if (Object.keys(additions).length > 0) await mergeTranslationCache(translationFile(), additions)
        } catch (batchError) {
          error = String(batchError?.message ?? batchError)
          consecutiveFailures += 1
          // One bad batch should not abandon the rest; two in a row usually
          // means the provider is down, so stop spending.
          if (consecutiveFailures >= 2) break
        }
      }
    } finally {
      if (timer) clearTimeout(timer)
    }

    const translated = Object.keys(zh).length
    return {
      body: {
        ok: translated > 0,
        zh,
        translated,
        skipped: Math.max(0, pending.length - translated),
        chars: estimateChars(pending),
        provider: target.provider,
        model: target.model,
        ...(error ? { error } : {}),
      },
    }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: TRANSLATE_PATH,
      handler: handleTranslate,
    }),
  )

  // Forget one skill (or all) so the next "translate" calls the model again
  // instead of serving a stale/bad translation from the hash cache.
  const handleForgetTranslate = postJson(async (body) => {
    const names = Array.isArray(body?.names)
      ? body.names.filter((name) => typeof name === 'string' && name !== '')
      : null
    const next = await forgetTranslations(translationFile(), names)
    return {
      body: {
        ok: true,
        cached: Object.keys(next).length,
        forgotten: names === null ? 'all' : names.length,
      },
    }
  })

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: TRANSLATE_FORGET_PATH,
      handler: handleForgetTranslate,
    }),
  )
}
