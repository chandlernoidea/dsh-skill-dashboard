import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readUsageCache, usageCacheKey, writeUsageCache } from '../lib/usage-cache.js'

test('usageCacheKey follows the session list and its version fields', () => {
  const a = [{ header: { id: 'a', updatedAt: 1 } }, { header: { id: 'b', updatedAt: 2 } }]
  const same = [{ header: { id: 'a', updatedAt: 1 } }, { header: { id: 'b', updatedAt: 2 } }]
  const grown = [{ header: { id: 'a', updatedAt: 1 } }, { header: { id: 'b', updatedAt: 3 } }]
  const added = [...a, { header: { id: 'c', updatedAt: 4 } }]
  assert.equal(usageCacheKey(a), usageCacheKey(same))
  assert.notEqual(usageCacheKey(a), usageCacheKey(grown))
  assert.notEqual(usageCacheKey(a), usageCacheKey(added))
  assert.equal(usageCacheKey([{ header: { id: 'a', seq: 7 } }]), 'a:7')
})

test('the usage cache round-trips and ignores corrupt content', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skill-dash-usage-cache-'))
  const file = join(dir, 'nested', 'usage-cache.json')
  try {
    assert.equal(await readUsageCache(file), null)
    const tallies = [{ byName: { tdd: 2 }, manualByName: {}, lastByName: {}, manualLastByName: {}, failedByName: {} }]
    await writeUsageCache(file, 'a:1|b:2', tallies)
    const reading = await readUsageCache(file)
    assert.equal(reading.key, 'a:1|b:2')
    assert.deepEqual(reading.tallies, tallies)
    assert.equal(typeof reading.at, 'number')

    await writeFile(file, '{oops', 'utf8')
    assert.equal(await readUsageCache(file), null)
    await writeFile(file, '{"key":"x"}', 'utf8')
    assert.equal(await readUsageCache(file), null)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
