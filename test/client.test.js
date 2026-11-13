import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// The Client is one host-served module with no bundler, so nothing in it can
// be imported by a test. This harness evaluates the real file, applies it to a
// fake host, and renders both views with a React stub. It catches the class of
// failure that once took down three plugin UIs: a syntax error, or a name that
// does not exist on the render path (`T is not defined`, `pluginHealth is not
// defined`). It is deliberately not a DOM test.
const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

function readyPayload() {
  return {
    status: 'ready',
    skills: [
      {
        name: 'tdd',
        description: 'Use when writing a test-first change.',
        whenToUse: '',
        source: 'file',
        provider: '',
        path: '/skills/tdd/SKILL.md',
        modelInvocable: true,
        situation: 'code',
        situationSource: 'taxonomy',
        trigger: '',
        zh: '',
        repo: '',
      },
      {
        name: 'office',
        description: 'Generate office documents.',
        whenToUse: '',
        source: 'registry',
        provider: '',
        path: '',
        modelInvocable: false,
        situation: 'docs',
        situationSource: 'heuristic',
        trigger: '',
        zh: '',
        repo: '',
      },
    ],
    situations: [
      { id: 'code', title: '写代码', order: 10 },
      { id: 'docs', title: '写文档', order: 20 },
      { id: 'other', title: '其他', order: 999 },
    ],
    counts: { total: 2, manual: 1, files: 1, registry: 1, unmapped: 0 },
    error: '',
    stale: false,
    overrideNote: '',
    capabilities: { catalogOk: true, fatal: false, missing: [] },
    problem: null,
    plugins: null,
    model: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    translate: { available: true, provider: 'deepseek-official', model: 'deepseek-v4-flash', pending: 2, chars: 180, limit: 24 },
    skillsChanges: {
      added: [{ name: 'tdd', source: 'file', path: '/skills/tdd/SKILL.md' }],
      removed: [{ name: 'gone', source: 'file', path: '' }],
    },
    usage: {
      modelTotal: 1,
      manualTotal: 2,
      total: 3,
      failed: 1,
      partial: true,
      scanned: 1,
      sessionCount: 2,
      byName: { tdd: 1 },
      manualByName: { office: 2 },
      lastByName: { tdd: 1 },
      manualLastByName: { office: 2 },
      excluded: [],
    },
  }
}

function readyDiagnostics() {
  return {
    status: 'ready',
    data: {
      ok: true,
      plugins: {
        total: 3,
        active: 2,
        failed: 1,
        disabled: 1,
        disabledNames: [{ name: 'old-plugin', moduleName: 'old-plugin' }],
        failedNames: [{ name: 'bad-plugin', moduleName: 'bad-module', phase: 'failed', diagnostic: 'boom' }],
      },
      capabilities: {
        catalogOk: true,
        fatal: false,
        missing: [{ id: 'translator', label: '翻译服务', labelEn: 'Translation', role: 'aux' }],
      },
      taxonomy: { version: 1, situations: 8, skills: 45 },
      text: 'diagnostics report',
    },
    error: '',
  }
}

function loadClient({ diagnose = false, ready = true, starter = false, language = 'zh-CN' } = {}) {
  let definition = null
  const slots = []
  const sandbox = {
    __DSH_SKILL_DASHBOARD_TEST__: true,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    URLSearchParams,
    AbortController,
    navigator: { language },
    document: {
      createElement: () => ({ setAttribute() {}, remove() {}, textContent: '' }),
      head: { appendChild() {} },
    },
    fetch: async () => {
      throw new Error('render smoke test must not fetch')
    },
    window: {
      __ModuleLoader__: {
        load(value) {
          definition = value
        },
      },
    },
  }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox, { filename: 'client.js' })
  assert.ok(definition, 'window.__ModuleLoader__.load was not called')

  const React = {
    createElement(type, props, ...children) {
      return { type, props: props ?? {}, children }
    },
    useState(initial) {
      if (ready && initial !== null && typeof initial === 'object' && initial.status === 'loading') {
        const payload = readyPayload()
        if (starter) {
          payload.usage = {
            modelTotal: 0,
            manualTotal: 0,
            total: 0,
            failed: 0,
            partial: false,
            scanned: 0,
            sessionCount: 0,
            byName: {},
            manualByName: {},
            failedByName: {},
            lastByName: {},
            manualLastByName: {},
            excluded: [],
          }
        }
        return [payload, () => {}]
      }
      if (ready && initial !== null && typeof initial === 'object' && initial.status === 'idle') {
        return [readyDiagnostics(), () => {}]
      }
      if (diagnose && initial === 'skills') return ['diagnose', () => {}]
      return [initial, () => {}]
    },
    useEffect() {},
  }

  const ctx = {
    effect(fn) {
      const dispose = fn()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    get(name) {
      if (name === 'sidebarRightTabs') {
        return {
          register(value) {
            slots.push({ seat: 'tab', value })
            return () => {}
          },
        }
      }
      if (name === 'sidebarRight') {
        return { openTab() {}, isExpanded: () => true, toggleExpanded() {} }
      }
      return undefined
    },
    slots: {
      inject(name, fn) {
        const dispose = fn()
        return typeof dispose === 'function' ? dispose : () => {}
      },
      register(definitionValue, component) {
        slots.push({ seat: 'slot', definition: definitionValue, component })
        return () => {}
      },
    },
  }

  const client = definition.factory((name) => (name === 'react' ? React : {}))
  assert.equal(typeof client.apply, 'function')
  client.apply(ctx)

  const component = (seat, name) =>
    slots.find((entry) => entry.seat === seat && (entry.definition?.name === name || entry.value?.kind === name))?.component

  return {
    client,
    dashboard: component('slot', 'sidebar.right.pane.tab'),
    title: component('slot', 'sidebar.right.pane.tab.title'),
    openButton: component('slot', 'conversation.session.header.utilities'),
    tab: slots.find((entry) => entry.seat === 'tab')?.value,
  }
}

test('the Client loads, applies, and renders the diagnostics view', () => {
  const { dashboard, title, openButton, tab } = loadClient({ diagnose: true })
  assert.equal(typeof dashboard, 'function')
  assert.equal(typeof title, 'function')
  assert.equal(typeof openButton, 'function')

  // A missing `guideDesc` key used to render `undefined` in the sidebar guide.
  const guide = tab && Array.isArray(tab.guide) ? tab.guide[0] : null
  assert.ok(guide, 'the tab type must contribute a guide entry')
  assert.equal(typeof guide.description(), 'string')
  assert.ok(guide.description().length > 0)

  const tree = dashboard({ sessionId: 'session-test' })
  const rendered = JSON.stringify(tree)
  assert.match(rendered, /技能上手台/)
  assert.match(rendered, /触发体检/)
  assert.match(rendered, /调用情况/)
  assert.match(rendered, /上手画像/)
  assert.match(rendered, /你的工作流/)
  assert.match(rendered, /按处境看/)
  assert.match(rendered, /恢复默认归类/)
  assert.match(rendered, /只扫了 1\/2 个会话/)
  assert.match(rendered, /1 次调用失败/)

  assert.match(JSON.stringify(title()), /技能/)
  assert.match(JSON.stringify(openButton()), /技能/)
})

test('the Client renders the skills view with cards and usage bars', () => {
  const { dashboard } = loadClient()
  const tree = dashboard({ sessionId: 'session-test' })
  const rendered = JSON.stringify(tree)
  assert.match(rendered, /搜技能名或说明/)
  assert.match(rendered, /tdd/)
  assert.match(rendered, /office/)
  assert.match(rendered, /写代码/)
  assert.match(rendered, /写文档/)
  assert.match(rendered, /一键汉化/)
  assert.match(rendered, /再看一次新手引导/)
  assert.match(rendered, /技能有变化/)
  assert.match(rendered, /新增 1 个/)
  assert.match(rendered, /移除 1 个/)
  assert.match(rendered, /清理已移除的覆盖项/)
})

test('the classify row renders its chips from the card view', () => {
  // 改归属 used to read `data.situations` — a binding that only exists inside
  // Dashboard — so the first click threw a ReferenceError and took the panel
  // (and every later visit to the tab) down with it.
  const { client } = loadClient()
  const { renderSkillCard } = client.__internals
  const skill = readyPayload().skills[0]
  const view = {
    T: new Proxy({}, { get: (_, key) => String(key) }),
    isZh: false,
    zh: {},
    language: 'zh-CN',
    batchMode: false,
    picked: [],
    feedback: { name: '', kind: '' },
    classifying: skill.name,
    classifyBusy: false,
    classifyError: '',
    situations: readyPayload().situations,
    vagueSet: new Set(),
    newNames: new Set(),
    togglePick() {},
    copy() {},
    retranslate() {},
    copyOrigin() {},
    classify() {},
    setClassifying() {},
  }

  const rendered = JSON.stringify(renderSkillCard(view, skill))
  assert.match(rendered, /写代码/)
  assert.match(rendered, /其他/)
})

test('the Client shows a starter guide before the first skill call', () => {
  const { dashboard } = loadClient({ starter: true })
  const rendered = JSON.stringify(dashboard({ sessionId: 'session-test' }))
  assert.match(rendered, /第一次用/)
  assert.match(rendered, /tdd/)
})

test('the translation banner is only offered in the Chinese UI', () => {
  const { dashboard } = loadClient({ language: 'en-US' })
  const rendered = JSON.stringify(dashboard({ sessionId: 'session-test' }))
  assert.doesNotMatch(rendered, /Translate all/)
})

test('the Client pure helpers stay testable through the opt-in surface', () => {
  const { client } = loadClient()
  const {
    firstSentence,
    triggerFor,
    deriveUsageView,
    classifyUsage,
    classifySituations,
    pickStarterSkills,
    triggerAudit,
    filterSkills,
    groupSkills,
    groupUnused,
    buildChips,
  } = client.__internals

  assert.equal(firstSentence('写周报。把本周的工作整理成文档。'), '写周报')
  assert.equal(firstSentence('Use when writing a test. Then run it.'), 'Use when writing a test')
  assert.equal(firstSentence('No sentence stop'), 'No sentence stop')

  assert.equal(triggerFor({ name: 'office', modelInvocable: false }, 'zh'), '/office')
  assert.equal(triggerFor({ name: 'tdd', modelInvocable: true, trigger: '用 tdd 写测试' }, 'zh'), '用 tdd 写测试')
  assert.match(triggerFor({ name: 'pr', modelInvocable: true, description: 'Create a PR.' }, 'en'), /Use the pr skill/)

  const usage = deriveUsageView({
    modelTotal: 2,
    manualTotal: 3,
    failed: 1,
    partial: true,
    available: false,
    byName: { alpha: 2 },
    manualByName: { beta: 3 },
    lastByName: { alpha: 5 },
    manualLastByName: { beta: 6 },
  })
  assert.equal(usage.modelCalls, 2)
  assert.equal(usage.manualTotal, 3)
  assert.equal(usage.failedCalls, 1)
  assert.equal(usage.usageUnavailable, true)
  assert.equal(usage.partialScan, true)
  assert.equal(usage.usedNames.has('beta'), true)
  assert.deepEqual(Array.from(usage.topSkills, ([name, count]) => `${name}:${count}`), ['alpha:2'])
  assert.deepEqual(Array.from(usage.topManual, ([name, count]) => `${name}:${count}`), ['beta:3'])

  const skills = [
    { name: 'alpha', description: 'Use when testing', modelInvocable: true, path: '/a', situation: 'code', whenToUse: '' },
    { name: 'beta', description: 'office helper', modelInvocable: false, path: '', situation: 'docs', whenToUse: '' },
    { name: 'gamma', description: 'unclear', modelInvocable: true, path: '', situation: 'other', whenToUse: '' },
  ]
  const audit = triggerAudit(skills)
  assert.deepEqual(Array.from(audit.vagueSkills, (skill) => skill.name), ['gamma'])
  assert.equal(audit.vagueSet.has('gamma'), true)

  assert.deepEqual(Array.from(filterSkills(skills, 'office', 'all', audit.vagueSet), (skill) => skill.name), ['beta'])
  assert.deepEqual(Array.from(filterSkills(skills, '', 'manual', audit.vagueSet), (skill) => skill.name), ['beta'])
  assert.deepEqual(Array.from(filterSkills(skills, '', 'files', audit.vagueSet), (skill) => skill.name), ['alpha'])
  assert.deepEqual(Array.from(filterSkills(skills, '', 'registry', audit.vagueSet), (skill) => skill.name), ['beta', 'gamma'])
  assert.deepEqual(Array.from(filterSkills(skills, '', 'vague', audit.vagueSet), (skill) => skill.name), ['gamma'])
  assert.deepEqual(Array.from(filterSkills(skills, '', 'unused', audit.vagueSet, '', new Set(['alpha'])), (skill) => skill.name), ['beta', 'gamma'])
  assert.deepEqual(Array.from(filterSkills(skills, '', 'all', audit.vagueSet, 'docs'), (skill) => skill.name), ['beta'])

  const situations = [
    { id: 'code', title: '写代码', order: 10 },
    { id: 'docs', title: '写文档', order: 20 },
    { id: 'other', title: '其他', order: 999 },
  ]
  const ordered = groupSkills(skills, situations)
  assert.deepEqual(Array.from(ordered, (group) => group.id), ['code', 'docs', 'other'])

  const unused = groupUnused(skills, new Set(['alpha']), situations)
  assert.deepEqual(Array.from(unused.unusedSkills, (skill) => skill.name), ['beta', 'gamma'])
  assert.deepEqual(Array.from(unused.unusedGroups, (group) => group.id), ['docs', 'other'])

  const chips = buildChips(
    { all: '全部', manual: '需点名', files: '有文件', registry: '注册表', vague: '无触发', unusedFilter: '未使用' },
    { total: 3, manual: 1, files: 1, registry: 2 },
    1,
    2,
  )
  assert.deepEqual(Array.from(chips, (chip) => chip.value), ['all', 'manual', 'files', 'registry', 'vague', 'unused'])
  assert.equal(chips[4].count, 1)
  assert.equal(chips[5].count, 2)

  const profile = classifyUsage(
    { byName: { alpha: 3 }, manualByName: { beta: 2 }, failedByName: { gamma: 1 } },
    [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }, { name: 'delta' }],
  )
  assert.deepEqual(Array.from(profile.auto, (item) => item.name), ['alpha'])
  assert.deepEqual(Array.from(profile.workflow, (item) => item.name), ['beta'])
  assert.deepEqual(Array.from(profile.failed, (item) => item.name), ['gamma'])
  assert.deepEqual(Array.from(profile.idle, (item) => item.name), ['delta'])
  assert.equal(profile.counts.auto, 1)
  assert.equal(profile.counts.workflow, 1)
  assert.equal(profile.counts.idle, 1)
  assert.equal(profile.counts.failed, 1)

  const bySituation = classifySituations(
    [
      { name: 'alpha', situation: 'code' },
      { name: 'beta', situation: 'code' },
      { name: 'gamma', situation: 'docs' },
    ],
    { byName: { alpha: 2 }, manualByName: { beta: 1 } },
  )
  assert.deepEqual(Array.from(bySituation, (group) => group.id), ['code', 'docs'])
  assert.equal(bySituation[0].model, 2)
  assert.equal(bySituation[0].manual, 1)
  assert.equal(bySituation[0].used, 2)
  assert.equal(bySituation[0].skills, 2)
  assert.equal(bySituation[1].model + bySituation[1].manual, 0)

  const starter = pickStarterSkills(
    [
      { name: 'alpha', situation: 'code', modelInvocable: true, description: 'Use when writing code.' },
      { name: 'beta', situation: 'docs', modelInvocable: true, description: 'Use when writing docs.' },
      { name: 'gamma', situation: 'code', modelInvocable: true, description: 'Use when reviewing code.' },
      { name: 'delta', situation: 'learn', modelInvocable: false, description: 'Use when learning.' },
      { name: 'epsilon', situation: 'other', modelInvocable: true, description: 'no trigger marker' },
    ],
    { auto: [{ name: 'beta' }], workflow: [] },
  )
  assert.deepEqual(Array.from(starter, (skill) => skill.name), ['alpha', 'gamma'])
})
