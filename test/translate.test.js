import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildPrompt,
  estimateChars,
  forgetTranslations,
  mergeTranslationCache,
  parseTranslations,
  pendingSkills,
  readTranslationCache,
  removeTranslations,
  sourceHash,
  translateBatch,
  translationsFor,
} from '../lib/translate.js'

const skill = (name, description, whenToUse = '') => ({ name, description, whenToUse })

function fakeLlm(payload, reason = { kind: 'stop' }) {
  const calls = []
  return {
    calls,
    async *stream(options) {
      calls.push(options)
      yield { type: 'text-delta', index: 0, text: payload }
      yield { type: 'finish', reason }
    },
  }
}

test('buildPrompt includes the skill text and the JSON instruction', () => {
  const prompt = buildPrompt([skill('tdd', 'Use when writing a test.', 'before coding')])
  assert.match(prompt, /name: tdd/)
  assert.match(prompt, /description: Use when writing a test\./)
  assert.match(prompt, /whenToUse: before coding/)
  assert.match(prompt, /JSON array/)
  assert.ok(estimateChars([skill('tdd', 'hello')]) > 0)
})

test('parseTranslations accepts a JSON array, a fence, and an object map', () => {
  assert.deepEqual(parseTranslations('[{"name":"tdd","zh":"测试驱动开发"}]', ['tdd']), { tdd: '测试驱动开发' })
  assert.deepEqual(parseTranslations('```json\n[{"name":"tdd","zh":"测试"}]\n```', ['tdd']), { tdd: '测试' })
  assert.deepEqual(parseTranslations('{"tdd":"测试"}', ['tdd']), { tdd: '测试' })
  assert.deepEqual(parseTranslations('[{"name":"other","zh":"别的"}]', ['tdd']), {})
})

test('parseTranslations rejects text without JSON', () => {
  assert.throws(() => parseTranslations('sorry, no json', ['tdd']), /无法解析/)
})

test('pendingSkills skips a fresh cache entry and keeps stale ones', () => {
  const fresh = skill('tdd', 'Use when writing tests.')
  const stale = skill('pr', 'Create a pull request.')
  const cache = {
    tdd: { hash: sourceHash(fresh), zh: '写测试时使用。' },
    pr: { hash: 'old', zh: '旧翻译' },
  }
  assert.deepEqual(pendingSkills([fresh, stale], cache).map((item) => item.name), ['pr'])
  assert.deepEqual(translationsFor([fresh, stale], cache), { tdd: '写测试时使用。' })
  assert.deepEqual(pendingSkills([skill('empty', '')], cache), [])
})

test('translateBatch streams the selected model and parses the result', async () => {
  const llm = fakeLlm('[{"name":"tdd","zh":"测试驱动开发"}]')
  const zh = await translateBatch({
    llm,
    target: { provider: 'deepseek-official', model: 'deepseek-v4-flash' },
    sessionId: 'session-1',
    skills: [skill('tdd', 'Use when writing tests.')],
  })
  assert.deepEqual(zh, { tdd: '测试驱动开发' })
  assert.equal(llm.calls.length, 1)
  assert.equal(llm.calls[0].provider, 'deepseek-official')
  assert.equal(llm.calls[0].model, 'deepseek-v4-flash')
  assert.equal(llm.calls[0].sessionId, 'session-1')
  assert.equal(llm.calls[0].purpose, 'skill-dashboard-translate')
})

test('translateBatch refuses a truncated or empty model answer', async () => {
  await assert.rejects(
    translateBatch({
      llm: fakeLlm('[{"name":"tdd","zh":"测试"', { kind: 'max-tokens' }),
      target: { provider: 'p', model: 'm' },
      skills: [skill('tdd', 'Use when writing tests.')],
    }),
    /截断/,
  )
  await assert.rejects(
    translateBatch({
      llm: fakeLlm('[]'),
      target: { provider: 'p', model: 'm' },
      skills: [skill('tdd', 'Use when writing tests.')],
    }),
    /没有返回/,
  )
  await assert.rejects(
    translateBatch({
      llm: fakeLlm('[{"name":"tdd","zh":"测试"}]'),
      target: null,
      skills: [skill('tdd', 'Use when writing tests.')],
    }),
    /没有选中模型/,
  )
})

test('translateBatch halves the batch when the model hits max tokens', async () => {
  let calls = 0
  const llm = {
    async *stream(options) {
      calls += 1
      const prompt = options.messages[options.messages.length - 1].content[0].text
      if (prompt.includes('alpha') && prompt.includes('beta')) {
        yield { type: 'text-delta', index: 0, text: '[{"name":"alpha","zh":"甲"' }
        yield { type: 'finish', reason: { kind: 'max-tokens' } }
        return
      }
      const name = prompt.includes('alpha') ? 'alpha' : 'beta'
      yield { type: 'text-delta', index: 0, text: JSON.stringify([{ name, zh: name === 'alpha' ? '甲' : '乙' }]) }
      yield { type: 'finish', reason: { kind: 'stop' } }
    },
  }
  const zh = await translateBatch({
    llm,
    target: { provider: 'p', model: 'm' },
    skills: [skill('alpha', 'a'), skill('beta', 'b')],
  })
  assert.deepEqual(zh, { alpha: '甲', beta: '乙' })
  assert.equal(calls, 3)
})

test('translateBatch reports truncation for a single skill instead of inventing text', async () => {
  await assert.rejects(
    translateBatch({
      llm: fakeLlm('[{"name":"alpha","zh":"甲"', { kind: 'max-tokens' }),
      target: { provider: 'p', model: 'm' },
      skills: [skill('alpha', 'a')],
    }),
    /截断/,
  )
})

test('removeTranslations forgets only the named entries', () => {
  const cache = {
    alpha: { hash: 'a', zh: '甲' },
    beta: { hash: 'b', zh: '乙' },
  }
  assert.deepEqual(removeTranslations(cache, ['alpha']), { beta: { hash: 'b', zh: '乙' } })
  assert.deepEqual(removeTranslations(cache, []), cache)
  assert.deepEqual(removeTranslations(cache), {})
})

test('forgetTranslations removes one entry from disk', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-dash-forget-'))
  const file = join(dir, 'translations.json')
  try {
    await mergeTranslationCache(file, {
      alpha: { hash: 'a', zh: '甲' },
      beta: { hash: 'b', zh: '乙' },
    })
    await forgetTranslations(file, ['alpha'])
    assert.deepEqual(await readTranslationCache(file), { beta: { hash: 'b', zh: '乙' } })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the translation cache merges under the queue and ignores corruption', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-dash-translate-'))
  const file = join(dir, 'nested', 'translations.json')
  try {
    await mergeTranslationCache(file, { tdd: { hash: 'h1', zh: '测试' } })
    await Promise.all([
      mergeTranslationCache(file, { pr: { hash: 'h2', zh: '评审' } }),
      mergeTranslationCache(file, { office: { hash: 'h3', zh: '办公' } }),
    ])
    const saved = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(Object.keys(saved).sort(), ['office', 'pr', 'tdd'])

    await writeFile(file, '{oops', 'utf8')
    assert.deepEqual(await readTranslationCache(file), {})
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
