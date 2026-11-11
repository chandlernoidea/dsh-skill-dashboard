import test from 'node:test'
import assert from 'node:assert/strict'

import { summarizeAvailability } from '../lib/capabilities.js'

const all = {
  sessionSkillCatalog: true,
  skills: true,
  sessions: true,
  translator: true,
}

test('everything present: nothing missing, not fatal', () => {
  const summary = summarizeAvailability(all)
  assert.equal(summary.catalogOk, true)
  assert.equal(summary.fatal, false)
  assert.deepEqual(summary.missing, [])
})

test('auxiliary capability missing: still usable, not fatal', () => {
  const summary = summarizeAvailability({ ...all, translator: false })
  assert.equal(summary.fatal, false)
  assert.deepEqual(summary.missing.map((capability) => capability.id), ['translator'])
})

test('one catalog source missing: still usable through the other', () => {
  const summary = summarizeAvailability({ ...all, sessionSkillCatalog: false })
  assert.equal(summary.catalogOk, true)
  assert.equal(summary.fatal, false)
})

test('both catalog sources missing: fatal, catalog entries reported', () => {
  const summary = summarizeAvailability({ ...all, sessionSkillCatalog: false, skills: false })
  assert.equal(summary.catalogOk, false)
  assert.equal(summary.fatal, true)
  assert.deepEqual(
    summary.missing.filter((capability) => capability.role === 'catalog').map((capability) => capability.id),
    ['sessionSkillCatalog', 'skills'],
  )
})

test('an empty report is fatal rather than a crash', () => {
  const summary = summarizeAvailability(undefined)
  assert.equal(summary.fatal, true)
  assert.equal(summary.missing.length, 4)
})
