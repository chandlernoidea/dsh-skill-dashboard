/**
 * Host half of dsh-skill-dashboard.
 *
 * Serves the skill catalog as JSON for the Client tab.
 *
 * Primary source is `sessionSkillCatalog`, the host service behind the UI's
 * own skill menu: it lists the user-invocable skills of ONE session
 * composition, so user skills, project skills, bundled skills and the
 * runtime-registered (registry, no file) ones all appear together — the same
 * set the model sees, without activating a cold Agent.
 *
 * `taxonomy.json` then labels each skill with the situation it belongs to and
 * an optional trigger phrase. It is plain data so the community can fix a
 * grouping by editing one file; a skill missing from it still shows up, under
 * "other".
 */

import { readFile, stat } from 'node:fs/promises'

export const name = 'dsh-skill-dashboard'

export const inject = ['webServer']

const ROUTE_PATH = '/api/skill-dash/data'
const TAXONOMY_URL = new URL('./taxonomy.json', import.meta.url)

const FALLBACK_TAXONOMY = {
  version: 0,
  situations: [{ id: 'other', title: '其他', order: 999 }],
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
    ctxLoggerWarn('skill-dashboard: taxonomy unavailable, falling back', error)
    return taxonomyCache.data ?? FALLBACK_TAXONOMY
  }
}

function ctxLoggerWarn(message, error) {
  // No plugin logger reaches this module before `apply`; the host console is
  // the only place a broken taxonomy can surface.
  console.warn(message, error)
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

function labelWithTaxonomy(items, taxonomy) {
  const byName = taxonomy.skills ?? {}
  return items.map((item) => {
    const entry = byName[item.name] ?? null
    return {
      ...item,
      situation: entry?.situation ?? 'other',
      trigger: typeof entry?.trigger === 'string' ? entry.trigger : '',
      repo: typeof entry?.repo === 'string' ? entry.repo : '',
    }
  })
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
    const signal = request?.signal ?? new AbortController().signal
    let result
    try {
      result = await readCatalog(new URL(request.url), signal)
    } catch (error) {
      return json({ ok: false, error: String(error?.message ?? error), skills: [] }, 500)
    }
    const skills = result.items
    if (skills === null) {
      return json({ ok: false, error: result.error || 'catalog unavailable', via: result.via, skills: [] }, 503)
    }

    const taxonomy = await loadTaxonomy()
    const labelled = labelWithTaxonomy(skills, taxonomy).sort((a, b) => a.name.localeCompare(b.name))
    const situations = [...(taxonomy.situations ?? FALLBACK_TAXONOMY.situations)].sort((a, b) => a.order - b.order)

    return json({
      ok: true,
      via: result.via,
      note: result.note || '',
      generatedAt: Date.now(),
      taxonomyVersion: taxonomy.version ?? 0,
      situations,
      counts: {
        total: labelled.length,
        manual: labelled.filter((item) => !item.modelInvocable).length,
        files: labelled.filter((item) => item.path).length,
        registry: labelled.filter((item) => !item.path).length,
        unmapped: labelled.filter((item) => item.situation === 'other').length,
      },
      skills: labelled,
    })
  }

  ctx.effect(() =>
    server.register({
      kind: 'exact',
      path: ROUTE_PATH,
      resource: async (request) => handle(request),
    }),
  )
}
