import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assignSituation,
  normalizeOverride,
  pruneOverride,
  readOverride,
  replaceOverride,
  restoreUndo,
  saveUndo,
  setExcluded,
  updateOverride,
} from '../lib/override.js'

async function workspace() {
  const dir = await mkdtemp(join(tmpdir(), 'skill-dash-'))
  await mkdir(join(dir, 'nested'), { recursive: true })
  return { dir, file: join(dir, 'nested', 'taxonomy.json') }
}

test('readOverride treats a missing file as normal', async () => {
  const { dir, file } = await workspace()
  try {
    const reading = await readOverride(file)
    assert.equal(reading.data, null)
    assert.equal(reading.note, '')
    assert.equal(reading.file, file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('normalizeOverride keeps unknown keys and reports bad fields', () => {
  const normalized = normalizeOverride({
    version: 3,
    team: { owner: 'me' },
    skills: {
      good: { situation: 'code', future: 'kept' },
      bad: { situation: 42 },
      worse: 'not an object',
    },
    exclude: ['noisy', 'noisy', 7, ''],
  })
  assert.equal(normalized.data.version, 3)
  assert.deepEqual(normalized.data.team, { owner: 'me' })
  assert.deepEqual(normalized.data.skills.good, { situation: 'code', future: 'kept' })
  assert.deepEqual(normalized.data.skills.bad, {})
  assert.equal(normalized.data.skills.worse, undefined)
  assert.deepEqual(normalized.data.exclude, ['noisy'])
  assert.equal(normalized.problems.length, 2)
})

test('normalizeOverride rejects a non-object outright', () => {
  assert.equal(normalizeOverride([]), null)
  assert.equal(normalizeOverride('nope'), null)
  assert.equal(normalizeOverride(null), null)
})

test('updateOverride creates the file and applies the assignment', async () => {
  const { dir, file } = await workspace()
  try {
    const result = await updateOverride(file, (data) => assignSituation(data, ['tdd'], 'code'))
    assert.equal(result.backup, '')
    const saved = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(saved.skills, { tdd: { situation: 'code' } })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('updateOverride preserves unknown top-level keys and existing skills', async () => {
  const { dir, file } = await workspace()
  try {
    await writeFile(file, JSON.stringify({ version: 1, team: 'x', skills: { pr: { situation: 'review', zh: '评审' } } }), 'utf8')
    await updateOverride(file, (data) => assignSituation(data, ['tdd'], 'code'))
    const saved = JSON.parse(await readFile(file, 'utf8'))
    assert.equal(saved.version, 1)
    assert.equal(saved.team, 'x')
    assert.deepEqual(saved.skills.pr, { situation: 'review', zh: '评审' })
    assert.deepEqual(saved.skills.tdd, { situation: 'code' })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a corrupt table is backed up before it is replaced', async () => {
  const { dir, file } = await workspace()
  try {
    const corrupt = '{"skills": {"tdd": '
    await writeFile(file, corrupt, 'utf8')
    const result = await updateOverride(file, (data) => assignSituation(data, ['pr'], 'review'))
    assert.notEqual(result.backup, '')
    assert.equal(await readFile(result.backup, 'utf8'), corrupt)

    const saved = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(saved.skills, { pr: { situation: 'review' } })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a table that is valid JSON but not an object is backed up too', async () => {
  const { dir, file } = await workspace()
  try {
    await writeFile(file, '[]', 'utf8')
    const result = await updateOverride(file, (data) => assignSituation(data, ['pr'], 'review'))
    assert.notEqual(result.backup, '')
    assert.equal(JSON.parse(await readFile(file, 'utf8')).skills.pr.situation, 'review')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('a malformed but parseable table is backed up before the write cleans it', async () => {
  const { dir, file } = await workspace()
  try {
    const original = '{"skills":{"good":{"situation":"code"},"bad":"nope"}}'
    await writeFile(file, original, 'utf8')
    const result = await updateOverride(file, (data) => assignSituation(data, ['fresh'], 'docs'))
    assert.notEqual(result.backup, '')
    assert.equal(await readFile(result.backup, 'utf8'), original)

    const saved = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(saved.skills, {
      good: { situation: 'code' },
      fresh: { situation: 'docs' },
    })
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('concurrent writes are serialised, so neither update is lost', async () => {
  const { dir, file } = await workspace()
  try {
    await Promise.all([
      updateOverride(file, (data) => assignSituation(data, ['alpha'], 'code')),
      updateOverride(file, (data) => assignSituation(data, ['beta'], 'docs')),
      updateOverride(file, (data) => setExcluded(data, 'noisy', true)),
    ])
    const saved = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(saved.skills, {
      alpha: { situation: 'code' },
      beta: { situation: 'docs' },
    })
    assert.deepEqual(saved.exclude, ['noisy'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('setExcluded removes the key when the list becomes empty', () => {
  const added = setExcluded({}, 'noisy', true)
  assert.deepEqual(added.exclude, ['noisy'])
  const removed = setExcluded(added, 'noisy', false)
  assert.equal('exclude' in removed, false)
})

test('readOverride reports a malformed table without writing', async () => {
  const { dir, file } = await workspace()
  try {
    await writeFile(file, '{oops', 'utf8')
    const reading = await readOverride(file)
    assert.equal(reading.data, null)
    assert.match(reading.note, /读取失败/)
    const files = await readdir(dir)
    assert.deepEqual(files, ['nested'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('replaceOverride writes the imported table and leaves no temp file', async () => {
  const { dir, file } = await workspace()
  try {
    await replaceOverride(file, { skills: { tdd: { situation: 'code' } }, exclude: ['noisy'] })
    const saved = JSON.parse(await readFile(file, 'utf8'))
    assert.deepEqual(saved.skills, { tdd: { situation: 'code' } })
    assert.deepEqual(saved.exclude, ['noisy'])
    const leftovers = (await readdir(join(dir, 'nested'))).filter((name) => name.includes('.tmp'))
    assert.deepEqual(leftovers, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('pruneOverride removes skills and exclusions for removed skills', () => {
  const input = {
    skills: { alpha: { situation: 'code' }, beta: { situation: 'docs' } },
    exclude: ['alpha', 'noisy'],
  }
  assert.deepEqual(pruneOverride(input, ['alpha', 'gone']), {
    skills: { beta: { situation: 'docs' } },
    exclude: ['noisy'],
  })
  assert.deepEqual(pruneOverride(input, []), input)
})

test('saveUndo restores exactly one previous plan', async () => {
  const { dir, file } = await workspace()
  try {
    await replaceOverride(file, { skills: { tdd: { situation: 'code' } } })
    await saveUndo(file, { skills: { tdd: { situation: 'docs' } } })
    await replaceOverride(file, { skills: { pr: { situation: 'review' } } })

    const restored = await restoreUndo(file)
    assert.deepEqual(restored, { skills: { tdd: { situation: 'docs' } } })
    assert.deepEqual((await readOverride(file)).data, { skills: { tdd: { situation: 'docs' } } })
    assert.equal(await restoreUndo(file), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
