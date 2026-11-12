import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { apply } from '../index.js'

const skill = (name, description = `Use when handling ${name}.`) => ({
  name,
  description,
  path: `/skills/${name}/SKILL.md`,
  modelInvocable: true,
})

const call = (name, callId) => ({ type: 'tool/call', data: { name: 'skill', arguments: JSON.stringify({ name }), callId } })
const result = (callId) => ({ type: 'tool/result', data: { message: { source: { callId } } } })
const manual = (name) => ({
  type: 'user/message',
  data: { message: { source: { kind: 'skill-invocation', name, form: 'instructions' } } },
})

async function makeApp({ catalog = [skill('alpha'), skill('beta')], events = [], llmMode = 'ok' } = {}) {
  const home = await mkdtemp(join(tmpdir(), 'skill-dash-routes-'))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const state = {
    catalog,
    events,
    llmCalls: 0,
    llmMode,
    catalogCalls: 0,
    sessions: [{ header: { id: 's1', updatedAt: 1 } }],
  }
  const routes = new Map()
  const ctx = {
    get(name) {
      if (name === 'webServer') {
        return { register(definition) { routes.set(definition.path, definition); return () => {} } }
      }
      if (name === 'sessionSkillCatalog') {
        return {
          async list() {
            state.catalogCalls += 1
            return { skills: state.catalog }
          },
        }
      }
      if (name === 'skills') return { async list() { return state.catalog } }
      if (name === 'sessions') {
        return {
          list: () => [{ id: 's1' }],
          get: () => ({ snapshotEvents: () => state.events }),
          scope: async () => ({}),
        }
      }
      if (name === 'sessionQuery') {
        return {
          async listSessions() { return state.sessions },
          async readSession() { return state.events },
        }
      }
      if (name === 'agents') {
        return { get: () => ({ model: { current: () => ({ provider: 'p', model: 'm' }) } }) }
      }
      if (name === 'llm') {
        return {
          async resolveModelInfo() {
            return { reasoning: { efforts: [{ id: 'low' }, { id: 'high' }] } }
          },
          async *stream(options) {
            state.llmCalls += 1
            if (state.llmMode === 'failFirst' && state.llmCalls === 1) throw new Error('fake batch failure')
            const prompt = options.messages[options.messages.length - 1].content[0].text
            const names = [...prompt.matchAll(/^name: (.+)$/gm)].map((match) => match[1].trim())
            const items = names.map((name) => ({ name, zh: `中-${name}` }))
            yield { type: 'text-delta', index: 0, text: JSON.stringify(items) }
            yield { type: 'finish', reason: { kind: 'stop' } }
          },
        }
      }
      if (name === 'pluginManager') return { async listPlugins() { return [] } }
      return undefined
    },
    effect(run) { run(); return () => {} },
  }
  apply(ctx)

  const getJson = async (path) => {
    const [pathname, query = ''] = path.split('?')
    const route = routes.get(pathname)
    assert.ok(route && route.resource, `missing GET route ${pathname}`)
    const response = await route.resource(new Request(`http://local${pathname}${query ? '?' + query : ''}`))
    return response.json()
  }

  const postJson = async (path, body) => {
    const route = routes.get(path)
    assert.ok(route && route.handler, `missing POST route ${path}`)
    const response = {
      status: 200,
      body: '',
      writeHead(status) { this.status = status },
      setHeader() {},
      end(chunk) { if (chunk !== undefined) this.body += chunk },
    }
    const request = Readable.from([Buffer.from(JSON.stringify(body))])
    request.method = 'POST'
    await route.handler(request, response)
    return { status: response.status, payload: JSON.parse(response.body) }
  }

  return {
    home,
    state,
    getJson,
    postJson,
    async cleanup() {
      await rm(home, { recursive: true, force: true })
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
    },
  }
}

test('route integration', async (t) => {
  await t.test('data composes once and reuses the catalog for a burst', async () => {
    const app = await makeApp({
      events: [call('alpha', 'c1'), result('c1'), manual('beta')],
    })
    try {
      const first = await app.getJson('/api/skill-dash/data?session=s1&lang=zh')
      assert.equal(first.ok, true)
      assert.equal(first.skills.length, 2)
      assert.equal(first.model.model, 'm')
      assert.equal(first.usage.modelTotal, 1)
      assert.equal(first.usage.manualTotal, 1)
      assert.equal(first.translate.available, true)
      assert.equal(app.state.catalogCalls, 1)

      const second = await app.getJson('/api/skill-dash/data?session=s1')
      assert.equal(second.ok, true)
      assert.equal(app.state.catalogCalls, 1)
    } finally {
      await app.cleanup()
    }
  })

  await t.test('all-session usage scans once and then hits the cache', async () => {
    const app = await makeApp({ events: [manual('alpha')] })
    try {
      const first = await app.getJson('/api/skill-dash/usage?scope=all')
      assert.equal(first.ok, true)
      assert.equal(first.cached, false)
      assert.equal(first.manualTotal, 1)
      const second = await app.getJson('/api/skill-dash/usage?scope=all')
      assert.equal(second.cached, true)
      assert.equal(second.manualTotal, 1)
    } finally {
      await app.cleanup()
    }
  })

  await t.test('override preview, import and undo write only the override file', async () => {
    const app = await makeApp()
    try {
      const preview = await app.postJson('/api/skill-dash/override/preview', {
        session: 's1',
        data: { skills: { alpha: { situation: 'learn' } }, exclude: ['noisy'] },
      })
      assert.equal(preview.status, 200)
      assert.equal(preview.payload.ok, true)
      assert.deepEqual(preview.payload.changes.map((change) => change.name), ['alpha'])

      const imported = await app.postJson('/api/skill-dash/override/import', {
        session: 's1',
        data: { skills: { alpha: { situation: 'learn' } }, exclude: ['noisy'] },
      })
      assert.equal(imported.status, 200)
      const stored = JSON.parse(await readFile(join(app.home, 'skill-dashboard', 'taxonomy.json'), 'utf8'))
      assert.equal(stored.skills.alpha.situation, 'learn')
      assert.deepEqual(stored.exclude, ['noisy'])

      const undo = await app.postJson('/api/skill-dash/override/undo', { session: 's1' })
      assert.equal(undo.status, 200)
      const restored = JSON.parse(await readFile(join(app.home, 'skill-dashboard', 'taxonomy.json'), 'utf8'))
      assert.deepEqual(restored.skills || {}, {})
      const again = await app.postJson('/api/skill-dash/override/undo', { session: 's1' })
      assert.equal(again.status, 400)
    } finally {
      await app.cleanup()
    }
  })

  await t.test('classify and exclude use the same write entry', async () => {
    const app = await makeApp()
    try {
      const classified = await app.postJson('/api/skill-dash/classify', { name: 'beta', situation: 'docs' })
      assert.equal(classified.status, 200)
      const excluded = await app.postJson('/api/skill-dash/exclude', { name: 'alpha', excluded: true })
      assert.equal(excluded.status, 200)
      const file = JSON.parse(await readFile(join(app.home, 'skill-dashboard', 'taxonomy.json'), 'utf8'))
      assert.equal(file.skills.beta.situation, 'docs')
      assert.deepEqual(file.exclude, ['alpha'])
    } finally {
      await app.cleanup()
    }
  })

  await t.test('translation requires consent, caches, and reuses the cache', async () => {
    const app = await makeApp()
    try {
      const denied = await app.postJson('/api/skill-dash/translate', { session: 's1', names: ['alpha'] })
      assert.equal(denied.status, 400)
      assert.equal(app.state.llmCalls, 0)

      const first = await app.postJson('/api/skill-dash/translate', {
        session: 's1',
        consent: true,
        names: ['alpha'],
      })
      assert.equal(first.status, 200)
      assert.equal(first.payload.zh.alpha, '中-alpha')
      assert.equal(app.state.llmCalls, 1)

      const data = await app.getJson('/api/skill-dash/data?session=s1')
      assert.equal(data.zh.alpha, '中-alpha')

      const cached = await app.postJson('/api/skill-dash/translate', {
        session: 's1',
        consent: true,
        names: ['alpha'],
      })
      assert.equal(cached.payload.translated, 0)
      assert.equal(app.state.llmCalls, 1)
    } finally {
      await app.cleanup()
    }
  })

  await t.test('translation continues after one failed batch', async () => {
    const many = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].map((name) => skill(name))
    const app = await makeApp({ catalog: many, llmMode: 'failFirst' })
    try {
      const response = await app.postJson('/api/skill-dash/translate', {
        session: 's1',
        consent: true,
        names: many.map((item) => item.name),
      })
      assert.equal(response.status, 200)
      assert.equal(response.payload.ok, true)
      assert.equal(response.payload.translated, 1)
      assert.equal(response.payload.skipped, 4)
      assert.match(response.payload.error, /fake batch failure/)
      assert.equal(app.state.llmCalls, 2)
      assert.equal(response.payload.zh.epsilon, '中-epsilon')
    } finally {
      await app.cleanup()
    }
  })

  await t.test('a single translation can be forgotten and retranslated', async () => {
    const app = await makeApp()
    try {
      const first = await app.postJson('/api/skill-dash/translate', { session: 's1', consent: true, names: ['alpha'] })
      assert.equal(first.payload.translated, 1)
      const forgotten = await app.postJson('/api/skill-dash/translate/forget', { session: 's1', names: ['alpha'] })
      assert.equal(forgotten.status, 200)
      const data = await app.getJson('/api/skill-dash/data?session=s1')
      assert.equal(data.zh.alpha, undefined)
      const again = await app.postJson('/api/skill-dash/translate', { session: 's1', consent: true, names: ['alpha'] })
      assert.equal(again.payload.translated, 1)
      assert.equal(app.state.llmCalls, 2)
    } finally {
      await app.cleanup()
    }
  })

  await t.test('removed skills can be pruned from the override table', async () => {
    const app = await makeApp()
    try {
      await app.postJson('/api/skill-dash/override/import', {
        session: 's1',
        data: { skills: { alpha: { situation: 'learn' } }, exclude: ['alpha'] },
      })
      const pruned = await app.postJson('/api/skill-dash/override/prune', { session: 's1', names: ['alpha'] })
      assert.equal(pruned.status, 200)
      const file = JSON.parse(await readFile(join(app.home, 'skill-dashboard', 'taxonomy.json'), 'utf8'))
      assert.deepEqual(file.skills || {}, {})
      assert.deepEqual(file.exclude || [], [])
    } finally {
      await app.cleanup()
    }
  })

  await t.test('skill change markers wait for an explicit acknowledge', async () => {
    const app = await makeApp()
    try {
      const first = await app.getJson('/api/skill-dash/data?session=s1')
      assert.deepEqual(first.skillsChanges, { added: [], removed: [] })

      app.state.catalog = [...app.state.catalog, skill('gamma')]
      await new Promise((resolve) => setTimeout(resolve, 600))
      const added = await app.getJson('/api/skill-dash/data?session=s1')
      assert.deepEqual(added.skillsChanges.added.map((item) => item.name), ['gamma'])
      const again = await app.getJson('/api/skill-dash/data?session=s1')
      assert.deepEqual(again.skillsChanges.added.map((item) => item.name), ['gamma'])

      const ack = await app.postJson('/api/skill-dash/skills/ack', { session: 's1' })
      assert.equal(ack.status, 200)
      const clean = await app.getJson('/api/skill-dash/data?session=s1')
      assert.deepEqual(clean.skillsChanges, { added: [], removed: [] })

      app.state.catalog = app.state.catalog.filter((item) => item.name !== 'beta')
      await new Promise((resolve) => setTimeout(resolve, 600))
      const removed = await app.getJson('/api/skill-dash/data?session=s1')
      assert.deepEqual(removed.skillsChanges.removed.map((item) => item.name), ['beta'])
    } finally {
      await app.cleanup()
    }
  })

  await t.test('diagnostics are on demand and include counts', async () => {
    const app = await makeApp()
    try {
      const diagnose = await app.getJson('/api/skill-dash/diagnose?session=s1&lang=zh')
      assert.equal(diagnose.ok, true)
      assert.equal(diagnose.counts.total, 2)
      assert.equal(diagnose.plugins.total, 0)
      assert.match(diagnose.text, /DSH/)
    } finally {
      await app.cleanup()
    }
  })
})
