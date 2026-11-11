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
import { tallySkillUsage } from './lib/usage.js'

export const name = 'dsh-skill-dashboard'

export const inject = ['webServer']

const ROUTE_PATH = '/api/skill-dash/data'
const ZH_PATH = '/api/skill-dash/zh'
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
  const file = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'skill-dashboard', 'taxonomy.json')
  try {
    const raw = await readFile(file, 'utf8')
    return { data: JSON.parse(raw), file, note: '' }
  } catch (error) {
    if (error && error.code === 'ENOENT') return { data: null, file, note: '' }
    return { data: null, file, note: `覆盖表读取失败，已忽略：${error?.message ?? error}` }
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
function readUsage(ctx, sessionId) {
  try {
    if (!sessionId) return null
    const sessions = ctx.get('sessions')
    const session = sessions?.get?.(sessionId)
    if (!session) return null
    // `ownEvents()` is only what this process appended; after a restart the
    // history is inherited, so count the whole log instead.
    const events =
      typeof session.snapshotEvents === 'function' ? session.snapshotEvents() : typeof session.ownEvents === 'function' ? session.ownEvents() : []
    const { total, byName } = tallySkillUsage(events)
    return { sessionId, total, byName }
  } catch (error) {
    console.warn('skill-dashboard: usage unavailable', error)
    return null
  }
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
    const plugins = await readPlugins(ctx)
    const usage = readUsage(ctx, sessionId)

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
        plugins,
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
      plugins,
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
}
