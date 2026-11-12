/**
 * Small disk cache for the "all sessions" usage scan.
 *
 * The scan reads up to 30 session logs and can take seconds. The key is the
 * session list itself (id + whatever version field the host exposes), so a new
 * or updated session triggers a fresh scan; a repeated toggle within the TTL is
 * instant. Only complete scans are cached — a timed-out scan is never reused.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const USAGE_CACHE_TTL_MS = 60_000
let temporaryCounter = 0

export function usageCacheKey(records) {
  return (records ?? [])
    .slice(0, 30)
    .map((record) => {
      const header = record?.header ?? {}
      const id = typeof header.id === 'string' ? header.id : ''
      const version = header.updatedAt ?? header.lastActiveAt ?? header.seq ?? header.messageCount ?? ''
      return `${id}:${String(version)}`
    })
    .join('|')
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** @returns {Promise<{ key: string, at: number, tallies: object[] } | null>} */
export async function readUsageCache(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (!isPlainObject(parsed)) return null
    if (typeof parsed.key !== 'string' || typeof parsed.at !== 'number') return null
    if (!Array.isArray(parsed.tallies)) return null
    return { key: parsed.key, at: parsed.at, tallies: parsed.tallies }
  } catch (error) {
    return null
  }
}

export async function writeUsageCache(file, key, tallies) {
  await mkdir(dirname(file), { recursive: true })
  temporaryCounter += 1
  const temporary = `${file}.${process.pid}.${Date.now()}.${temporaryCounter}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ key, at: Date.now(), tallies }, null, 2) + '\n', 'utf8')
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}
