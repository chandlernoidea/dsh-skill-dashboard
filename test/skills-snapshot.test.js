import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { diffSkills, readSkillsSnapshot, snapshotSkills, writeSkillsSnapshot } from '../lib/skills-snapshot.js'

test('diffSkills reports added and removed names, not changed descriptions', () => {
  const before = [
    { name: 'tdd', source: 'file', path: '/a' },
    { name: 'pr', source: 'file', path: '/b' },
  ]
  const after = [
    { name: 'tdd', source: 'file', path: '/a' },
    { name: 'office', source: 'registry', path: '' },
  ]
  const diff = diffSkills(before, after)
  assert.deepEqual(diff.added.map((skill) => skill.name), ['office'])
  assert.deepEqual(diff.removed.map((skill) => skill.name), ['pr'])
})

test('snapshotSkills drops nameless rows and sorts by name', () => {
  const snapshot = snapshotSkills([{ name: 'b' }, { name: '' }, null, { name: 'a', source: 'file' }])
  assert.deepEqual(snapshot.map((skill) => skill.name), ['a', 'b'])
})

test('the snapshot round-trips and treats corrupt content as absent', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-dash-snapshot-'))
  const file = join(dir, 'nested', 'skills-snapshot.json')
  try {
    assert.equal(await readSkillsSnapshot(file), null)
    await writeSkillsSnapshot(file, [{ name: 'tdd', source: 'file', path: '/a' }])
    const reading = await readSkillsSnapshot(file)
    assert.deepEqual(reading, [{ name: 'tdd', source: 'file', path: '/a' }])

    await writeFile(file, '{oops', 'utf8')
    assert.equal(await readSkillsSnapshot(file), null)
    await writeFile(file, '{"skills":"nope"}', 'utf8')
    assert.equal(await readSkillsSnapshot(file), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
