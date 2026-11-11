import test from 'node:test'
import assert from 'node:assert/strict'

import { composeDashboard, inferSituation, mergeTaxonomy } from '../lib/compose.js'

const taxonomy = {
  situations: [
    { id: 'code', title: '写代码', order: 10 },
    { id: 'docs', title: '写文档', order: 30 },
    { id: 'other', title: '其他', order: 999 },
  ],
  skills: {
    tdd: { situation: 'code' },
    handoff: {
      situation: 'docs',
      trigger: '用 handoff 把这次对话整理成交接文档',
      zh: '把当前对话压缩成一份交接文档。',
      repo: 'https://example.com/handoff',
    },
    ghost: { situation: 'no-such-situation' },
  },
}

function skill(name, extra = {}) {
  return { name, description: '', path: '', modelInvocable: true, ...extra }
}

test('inferSituation reads both languages', async (t) => {
  const cases = [
    ['excel-writer', 'Write your results into an xlsx spreadsheet', 'docs'],
    ['bug-hunter', 'Debug and patch failing tests in a legacy module', 'code'],
    ['chart-maker', 'Draw a diagram of the architecture', 'design'],
    ['pr-reviewer', 'Review the pull request before merge', 'review'],
    ['deep-dive', 'Investigate the literature and survey prior work', 'research'],
    ['onboarding', 'Teach me this concept with a tutorial', 'learn'],
    ['cordis-helper', 'Configure a cordis plugin preset', 'harness'],
    ['zh-weekly', '写周报并整理成文档', 'docs'],
    ['random-widget', 'Does something entirely unrelated', null],
  ]
  for (const [name, description, expected] of cases) {
    await t.test(name, () => {
      assert.equal(inferSituation(name, description), expected)
    })
  }
})

test('counts describe the catalog', () => {
  const { counts } = composeDashboard({
    skills: [
      skill('a', { modelInvocable: false }),
      skill('b', { path: '/tmp/b' }),
      skill('c', { path: '/tmp/c', modelInvocable: false }),
      skill('d'),
    ],
    taxonomy,
  })

  assert.equal(counts.total, 4)
  assert.equal(counts.manual, 2)
  assert.equal(counts.files, 2)
  assert.equal(counts.registry, 2)
})

test('skills come back sorted by name', () => {
  const { skills } = composeDashboard({ skills: [skill('zeta'), skill('alpha'), skill('mike')], taxonomy })
  assert.deepEqual(skills.map((item) => item.name), ['alpha', 'mike', 'zeta'])
})

test('situations keep taxonomy order and include the fallback', () => {
  const { situations } = composeDashboard({ skills: [], taxonomy })
  assert.deepEqual(situations.map((situation) => situation.id), ['code', 'docs', 'other'])
})

test('a taxonomy entry supplies situation, trigger, zh and repo', () => {
  const { skills } = composeDashboard({ skills: [skill('handoff')], taxonomy })
  assert.deepEqual(
    {
      situation: skills[0].situation,
      situationSource: skills[0].situationSource,
      trigger: skills[0].trigger,
      zh: skills[0].zh,
      repo: skills[0].repo,
    },
    {
      situation: 'docs',
      situationSource: 'taxonomy',
      trigger: '用 handoff 把这次对话整理成交接文档',
      zh: '把当前对话压缩成一份交接文档。',
      repo: 'https://example.com/handoff',
    },
  )
})

test('a taxonomy entry naming an unknown situation falls back to other', () => {
  const { skills } = composeDashboard({ skills: [skill('ghost')], taxonomy })
  assert.equal(skills[0].situation, 'other')
  assert.equal(skills[0].situationSource, 'taxonomy')
})

test('an unlisted skill is inferred, not dumped into other', () => {
  const { skills, counts } = composeDashboard({
    skills: [skill('bug-hunter', { description: 'Debug and patch failing tests' })],
    taxonomy,
  })
  assert.equal(skills[0].situation, 'code')
  assert.equal(skills[0].situationSource, 'heuristic')
  assert.equal(counts.unmapped, 0)
})

test('a skill nothing matches is unmapped and counted', () => {
  const { skills, counts } = composeDashboard({
    skills: [skill('random-widget', { description: 'Does something entirely unrelated' })],
    taxonomy,
  })
  assert.equal(skills[0].situation, 'other')
  assert.equal(skills[0].situationSource, 'unmapped')
  assert.equal(counts.unmapped, 1)
})

test('composition is pure: same input, same output', () => {
  const input = { skills: [skill('tdd'), skill('random-widget')], taxonomy }
  assert.deepEqual(composeDashboard(input), composeDashboard(input))
})

test('an override moves a skill to another situation', () => {
  const { skills } = composeDashboard({
    skills: [skill('handoff')],
    taxonomy,
    override: { skills: { handoff: { situation: 'code' } } },
  })
  assert.equal(skills[0].situation, 'code')
})

test('an override keeps the packaged trigger when it only changes the situation', () => {
  const { skills } = composeDashboard({
    skills: [skill('handoff')],
    taxonomy,
    override: { skills: { handoff: { situation: 'code' } } },
  })
  assert.equal(skills[0].trigger, '用 handoff 把这次对话整理成交接文档')
  assert.equal(skills[0].zh, '把当前对话压缩成一份交接文档。')
})

test('an override can add a situation', () => {
  const { situations } = composeDashboard({
    skills: [],
    taxonomy,
    override: { situations: [{ id: 'video', title: '做视频', order: 40 }] },
  })
  assert.deepEqual(situations.map((situation) => situation.id), ['code', 'docs', 'video', 'other'])
})

test('an override cannot remove a packaged skill or situation', () => {
  const merged = mergeTaxonomy(taxonomy, { situations: [], skills: {} })
  assert.equal(Object.keys(merged.skills).length, Object.keys(taxonomy.skills).length)
  assert.equal(merged.situations.length, taxonomy.situations.length)
})

test('a garbage override is ignored field by field', () => {
  const withArray = composeDashboard({ skills: [skill('tdd')], taxonomy, override: [] })
  const withString = composeDashboard({ skills: [skill('tdd')], taxonomy, override: 'nope' })
  const withBadEntry = composeDashboard({
    skills: [skill('tdd')],
    taxonomy,
    override: { skills: { tdd: null, other: { situation: 'docs' } } },
  })

  assert.equal(withArray.skills[0].situation, 'code')
  assert.equal(withString.skills[0].situation, 'code')
  assert.equal(withBadEntry.skills[0].situation, 'code')
})
