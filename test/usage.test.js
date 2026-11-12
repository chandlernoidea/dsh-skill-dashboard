import test from 'node:test'
import assert from 'node:assert/strict'

import { composeUsage, tallySkillUsage } from '../lib/usage.js'

const call = (name, args, callId) => ({ type: 'tool/call', data: { name, arguments: args, callId } })
const result = (callId, error) => ({
  type: 'tool/result',
  data: { message: { source: { callId } }, ...(error ? { error } : {}) },
})

const userMessage = (text) => ({ type: 'user/message', data: { message: { content: [{ type: 'text', text }] } } })
const manual = (name, time) => ({
  type: 'user/message',
  time,
  data: { message: { source: { kind: 'skill-invocation', name, form: 'instructions' } } },
})

test('counts successful skill calls by name', () => {
  const usage = tallySkillUsage([
    call('skill', JSON.stringify({ name: 'tdd' }), 'c1'),
    call('skill', JSON.stringify({ name: 'tdd' }), 'c2'),
    call('skill', JSON.stringify({ skill: 'pr' }), 'c3'),
    result('c1'),
    result('c2'),
    result('c3'),
  ])
  assert.equal(usage.modelTotal, 3)
  assert.equal(usage.manualTotal, 0)
  assert.deepEqual(usage.byName, { tdd: 2, pr: 1 })
  assert.equal(usage.failed, 0)
  assert.deepEqual(usage.lastByName, {})
})

test('a failed call counts as failed, not as usage', () => {
  const usage = tallySkillUsage([
    call('skill', JSON.stringify({ name: 'implement' }), 'c1'),
    result('c1', { name: 'Error', code: 'not-available' }),
    call('skill', JSON.stringify({ name: 'tdd' }), 'c2'),
    result('c2'),
  ])
  assert.equal(usage.modelTotal, 1)
  assert.deepEqual(usage.byName, { tdd: 1 })
  assert.equal(usage.failed, 1)
  assert.deepEqual(usage.failedByName, { implement: 1 })
})

test('a failure recorded as message.isError also counts as failed', () => {
  const usage = tallySkillUsage([
    call('skill', JSON.stringify({ name: 'to-spec' }), 'c9'),
    { type: 'tool/result', data: { message: { source: { callId: 'c9' }, isError: true } } },
  ])
  assert.equal(usage.modelTotal, 0)
  assert.equal(usage.failed, 1)
})

test('a /name gesture counts as a manual invocation, not a model call', () => {
  const usage = tallySkillUsage([
    manual('implement', 100),
    manual('implement', 300),
    { type: 'user/message', data: { message: { source: { kind: 'working-directory' } } } },
    call('skill', JSON.stringify({ name: 'tdd' }), 'c1'),
  ])
  assert.equal(usage.modelTotal, 1)
  assert.equal(usage.manualTotal, 2)
  assert.deepEqual(usage.byName, { tdd: 1 })
  assert.deepEqual(usage.manualByName, { implement: 2 })
  assert.deepEqual(usage.manualLastByName, { implement: 300 })
})

test('a user message that names a skill is just text, not a crash', () => {
  const usage = tallySkillUsage([
    userMessage('please use the tdd skill'),
    call('skill', JSON.stringify({ name: 'tdd' }), 'c1'),
    result('c1'),
  ])
  assert.equal(usage.modelTotal, 1)
  assert.deepEqual(usage.byName, { tdd: 1 })
  assert.equal(usage.failed, 0)
})

test('ignores other tools and other events', () => {
  const usage = tallySkillUsage([
    call('ops_bash', JSON.stringify({ command: 'ls' })),
    { type: 'assistant/message', data: { message: {} } },
    { type: 'user/message', data: {} },
  ])
  assert.equal(usage.modelTotal, 0)
  assert.deepEqual(usage.byName, {})
})

test('skips malformed arguments instead of counting an empty skill', () => {
  const usage = tallySkillUsage([
    call('skill', 'not json'),
    call('skill', JSON.stringify({})),
    call('skill', undefined),
    call('skill', JSON.stringify({ name: 'pr' })),
  ])
  assert.equal(usage.modelTotal, 1)
  assert.deepEqual(usage.byName, { pr: 1 })
})

test('tolerates a missing or malformed event list', () => {
  const empty = {
    modelTotal: 0,
    manualTotal: 0,
    failed: 0,
    byName: {},
    manualByName: {},
    lastByName: {},
    manualLastByName: {},
    failedByName: {},
  }
  assert.deepEqual(tallySkillUsage(undefined), empty)
  assert.deepEqual(tallySkillUsage([null, 42, 'x']), empty)
})

test('composeUsage sums model and manual calls into one total', () => {
  const usage = composeUsage([
    tallySkillUsage([
      call('skill', JSON.stringify({ name: 'tdd' }), 'c1'),
      manual('implement', 10),
      manual('implement', 20),
    ]),
  ])
  assert.equal(usage.modelTotal, 1)
  assert.equal(usage.manualTotal, 2)
  assert.equal(usage.total, 3)
  assert.deepEqual(usage.byName, { tdd: 1 })
  assert.deepEqual(usage.manualByName, { implement: 2 })
  assert.equal(usage.partial, false)
})

test('composeUsage merges sessions and keeps the latest timestamp', () => {
  const usage = composeUsage([
    { modelTotal: 0, manualTotal: 0, failed: 0, byName: { a: 1 }, manualByName: {}, lastByName: { a: 100 }, manualLastByName: {}, failedByName: {} },
    { modelTotal: 0, manualTotal: 0, failed: 0, byName: { a: 2, b: 1 }, manualByName: { a: 1 }, lastByName: { a: 300 }, manualLastByName: { a: 200 }, failedByName: { b: 1 } },
  ])
  assert.equal(usage.modelTotal, 4)
  assert.equal(usage.manualTotal, 1)
  assert.equal(usage.total, 5)
  assert.equal(usage.failed, 1)
  assert.equal(usage.lastByName.a, 300)
  assert.equal(usage.manualLastByName.a, 200)
})

test('composeUsage drops an excluded name from every number', () => {
  const usage = composeUsage(
    [
      tallySkillUsage([
        call('skill', JSON.stringify({ name: 'noisy' }), 'c1'),
        result('c1', { name: 'Error' }),
        call('skill', JSON.stringify({ name: 'tdd' }), 'c2'),
        manual('noisy', 5),
        manual('implement', 6),
      ]),
    ],
    { excluded: new Set(['noisy']) },
  )
  assert.equal(usage.modelTotal, 1)
  assert.equal(usage.manualTotal, 1)
  assert.equal(usage.total, 2)
  assert.equal(usage.failed, 0)
  assert.deepEqual(usage.byName, { tdd: 1 })
  assert.deepEqual(usage.manualByName, { implement: 1 })
  assert.deepEqual(usage.failedByName, {})
  assert.deepEqual(usage.excluded, ['noisy'])
})

test('composeUsage keeps failure counts per skill for the usage profile', () => {
  const usage = composeUsage([
    tallySkillUsage([
      call('skill', JSON.stringify({ name: 'broken' }), 'c1'),
      result('c1', { name: 'Error' }),
      call('skill', JSON.stringify({ name: 'tdd' }), 'c2'),
      result('c2'),
    ]),
  ])
  assert.equal(usage.failed, 1)
  assert.deepEqual(usage.failedByName, { broken: 1 })
})

test('composeUsage handles no tallies and the partial flag', () => {
  const usage = composeUsage(undefined, { partial: true })
  assert.equal(usage.modelTotal, 0)
  assert.equal(usage.manualTotal, 0)
  assert.equal(usage.total, 0)
  assert.equal(usage.failed, 0)
  assert.deepEqual(usage.byName, {})
  assert.equal(usage.partial, true)
})
