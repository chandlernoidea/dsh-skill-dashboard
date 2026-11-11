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
const ZH_PATH = '/api/skill-dash/zh'
const TAXONOMY_URL = new URL('./taxonomy.json', import.meta.url)

// Situation inference for skills that `taxonomy.json` does not list — a user who
// installs their own skills still gets them sorted. Order = first strong match
// wins; otherwise the most keyword hits above a threshold decides.
const STRONG_RULES = [
  [/pptx|docx|xlsx|spreadsheet|幻灯片|表格/i, 'docs'],
  [/blender|drawai|diagram|canvas|文字成片|视频/i, 'design'],
  [/\btdd\b|单元测试/i, 'code'],
  [/cordis|harness|sandbox|沙箱/i, 'harness'],
]

const SITUATION_RULES = [
  { id: 'docs', re: /(office|pdf|readme|handoff|spec\b|ticket|questionnaire|document|report|文档|工单|规格|报告)/gi },
  { id: 'design', re: /(diagram|chart|draw|video|motion|render|image|svg|图|画布|建模|出图)/gi },
  { id: 'review', re: /(review|audit|critique|triage|lint|grill|审查|评审|复盘|把关)/gi },
  { id: 'research', re: /(research|investigate|survey|literature|search|调研|检索|查证)/gi },
  { id: 'learn', re: /(teach|learn|tutorial|explain|course|学习|教程|讲解)/gi },
  { id: 'harness', re: /(plugin|cordis|harness|sandbox|preset|hook|config|插件|配置)/gi },
  { id: 'code', re: /(code|bug|debug|refactor|test|implement|build|compile|patch|feature|代码|重构|测试|实现|修复)/gi },
]

export function inferSituation(name, description) {
  const text = `${name} ${description}`
  for (const [re, id] of STRONG_RULES) if (re.test(text)) return id
  let best = null
  for (const rule of SITUATION_RULES) {
    const hits = (text.match(rule.re) || []).length
    if (hits > 0 && (best === null || hits > best.hits)) best = { id: rule.id, hits }
  }
  return best !== null && best.hits >= 1 ? best.id : null
}

function labelWithTaxonomy(items, taxonomy) {
  const byName = taxonomy.skills ?? {}
  return items.map((item) => {
    const entry = byName[item.name] ?? null
    if (entry !== null) {
      return {
        ...item,
        situation: entry.situation,
        situationSource: 'taxonomy',
        trigger: typeof entry.trigger === 'string' ? entry.trigger : '',
        zh: typeof entry.zh === 'string' ? entry.zh : '',
        repo: typeof entry.repo === 'string' ? entry.repo : '',
      }
    }
    const inferred = inferSituation(item.name, item.description)
    return {
      ...item,
      situation: inferred ?? 'other',
      situationSource: inferred === null ? 'unmapped' : 'heuristic',
      trigger: '',
      zh: '',
      repo: '',
    }
  })
}

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

  // On-the-spot Chinese for the manual-only skills. They are the ones a user
  // must name, so their description is the thing that has to be readable.
  // Anonymous providers (google/bing) need no session and no key.
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
