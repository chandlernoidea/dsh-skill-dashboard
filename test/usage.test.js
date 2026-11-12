import test from 'node:test'
import assert from 'node:assert/strict'

import { tallySkillUsage } from '../lib/usage.js'

const call = (name, args, callId) => ({ type: 'tool/call', data: { name, arguments: args, callId } })
const result = (callId, error) => ({
  type: 'tool/result',
  data: { message: { source: { callId } }, ...(error ? { error } : {}) },
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
  assert.equal(usage.total, 3)
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
  assert.equal(usage.total, 1)
  assert.deepEqual(usage.byName, { tdd: 1 })
  assert.equal(usage.failed, 1)
})

test('a failure recorded as message.isError also counts as failed', () => {
  const usage = tallySkillUsage([
    call('skill', JSON.stringify({ name: 'to-spec' }), 'c9'),
    { type: 'tool/result', data: { message: { source: { callId: 'c9' }, isError: true } } },
  ])
  assert.equal(usage.total, 0)
  assert.equal(usage.failed, 1)
})

test('a /name gesture counts as a manual invocation, not a model call', () => {
  const usage = tallySkillUsage([
    { type: 'user/message', time: 100, data: { message: { source: { kind: 'skill-invocation', name: 'implement', form: 'instructions' } } } },
    { type: 'user/message', time: 300, data: { message: { source: { kind: 'skill-invocation', name: 'implement', form: 'instructions' } } } },
    { type: 'user/message', data: { message: { source: { kind: 'working-directory' } } } },
    call('skill', JSON.stringify({ name: 'tdd' }), 'c1'),
  ])
  assert.equal(usage.total, 1)
  assert.deepEqual(usage.byName, { tdd: 1 })
  assert.deepEqual(usage.manualByName, { implement: 2 })
  assert.deepEqual(usage.manualLastByName, { implement: 300 })
})

test('ignores other tools and other events', () => {
  const usage = tallySkillUsage([
    call('ops_bash', JSON.stringify({ command: 'ls' })),
    { type: 'assistant/message', data: { message: {} } },
    { type: 'user/message', data: {} },
  ])
  assert.equal(usage.total, 0)
  assert.deepEqual(usage.byName, {})
})

test('skips malformed arguments instead of counting an empty skill', () => {
  const usage = tallySkillUsage([
    call('skill', 'not json'),
    call('skill', JSON.stringify({})),
    call('skill', undefined),
    call('skill', JSON.stringify({ name: 'pr' })),
  ])
  assert.equal(usage.total, 1)
  assert.deepEqual(usage.byName, { pr: 1 })
})

test('tolerates a missing or malformed event list', () => {
  assert.deepEqual(tallySkillUsage(undefined), { total: 0, byName: {}, failed: 0, lastByName: {}, manualByName: {}, manualLastByName: {} })
  assert.deepEqual(tallySkillUsage([null, 42, 'x']), { total: 0, byName: {}, failed: 0, lastByName: {}, manualByName: {}, manualLastByName: {} })
})
