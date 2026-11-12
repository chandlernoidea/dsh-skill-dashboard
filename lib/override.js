/**
 * The one read/write seam for the user's override table.
 *
 * Three routes used to carry their own read-modify-write copy. They shared a
 * single `.tmp` path and, worse, treated an unreadable table as `{}` — a
 * single corrupt character plus one "reclassify" click wiped everything the
 * user had written. This module owns that invariant instead:
 *
 * - shape is normalised and problems are reported, never guessed at silently
 * - an existing file that cannot be parsed is copied aside before it is replaced
 * - writes to the same file are serialised, so a batch classify and an exclude
 *   click cannot lose each other's update
 */

import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const QUEUES = new Map()
const KNOWN_SKILL_FIELDS = ['situation', 'trigger', 'zh', 'repo']
let temporaryCounter = 0

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Normalise whatever the user's file (or an import body) contains.
 * Unknown top-level keys and unknown fields on a skill entry survive; known
 * fields of the wrong type are dropped with a problem instead of poisoning
 * the table.
 *
 * @param {unknown} value
 * @returns {{ data: object, problems: string[] } | null} null when the value is not an object at all
 */
export function normalizeOverride(value) {
  if (!isPlainObject(value)) return null

  const problems = []
  const data = { ...value }

  if (value.skills !== undefined) {
    if (!isPlainObject(value.skills)) {
      problems.push('skills must be an object')
      delete data.skills
    } else {
      const skills = {}
      for (const [name, entry] of Object.entries(value.skills)) {
        if (!isPlainObject(entry)) {
          problems.push(`skills.${name} must be an object`)
          continue
        }
        const clean = { ...entry }
        for (const field of KNOWN_SKILL_FIELDS) {
          if (clean[field] !== undefined && typeof clean[field] !== 'string') {
            problems.push(`skills.${name}.${field} must be a string`)
            delete clean[field]
          }
        }
        skills[name] = clean
      }
      data.skills = skills
    }
  }

  if (value.exclude !== undefined) {
    if (!Array.isArray(value.exclude)) {
      problems.push('exclude must be an array')
      delete data.exclude
    } else {
      data.exclude = [...new Set(value.exclude.filter((entry) => typeof entry === 'string' && entry !== ''))]
    }
  }

  return { data, problems }
}

/** Assign one situation to one or more skills, keeping every other field. */
export function assignSituation(data, names, situation) {
  const next = { ...data, skills: { ...(isPlainObject(data?.skills) ? data.skills : {}) } }
  for (const name of names) {
    const previous = isPlainObject(next.skills[name]) ? next.skills[name] : {}
    next.skills[name] = { ...previous, situation }
  }
  return next
}

/** Add or remove one skill from the stats blacklist. */
export function pruneOverride(data, names) {
  const normalized = normalizeOverride(data)
  if (normalized === null) return {}
  const base = normalized.data
  const remove = new Set((names ?? []).filter((name) => typeof name === 'string' && name !== ''))
  if (remove.size === 0) return base
  const skills = { ...(base.skills ?? {}) }
  for (const name of remove) delete skills[name]
  const exclude = (Array.isArray(base.exclude) ? base.exclude : []).filter((name) => !remove.has(name))
  return { ...base, skills, exclude }
}

export function setExcluded(data, name, excluded) {  const next = { ...data }
  const current = Array.isArray(data?.exclude) ? data.exclude.filter((entry) => typeof entry === 'string') : []
  const updated = excluded ? [...new Set([...current, name])] : current.filter((entry) => entry !== name)
  if (updated.length === 0) delete next.exclude
  else next.exclude = updated
  return next
}

function serialise(file, task) {
  const previous = QUEUES.get(file) ?? Promise.resolve()
  const started = previous.then(task, task)
  const settled = started.catch(() => {})
  QUEUES.set(file, settled)
  settled.finally(() => {
    if (QUEUES.get(file) === settled) QUEUES.delete(file)
  })
  return started
}

async function writeAtomic(file, data) {
  await mkdir(dirname(file), { recursive: true })
  temporaryCounter += 1
  const temporary = `${file}.${process.pid}.${Date.now()}.${temporaryCounter}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(data, null, 2) + '\n', 'utf8')
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}

async function backupCorrupt(file) {
  temporaryCounter += 1
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${file}.corrupt-${stamp}-${temporaryCounter}`
  await copyFile(file, backup)
  return backup
}

/**
 * Read the table without writing. A missing file is normal; unreadable or
 * malformed content is ignored with a note the Client can show.
 *
 * @param {string} file
 * @returns {Promise<{ data: object|null, file: string, note: string }>}
 */
export async function readOverride(file) {
  let raw
  try {
    raw = await readFile(file, 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return { data: null, file, note: '' }
    return { data: null, file, note: `覆盖表读取失败，已忽略：${error?.message ?? error}` }
  }

  try {
    const normalized = normalizeOverride(JSON.parse(raw))
    if (normalized === null) return { data: null, file, note: '覆盖表格式不正确，已忽略' }
    return {
      data: normalized.data,
      file,
      note: normalized.problems.length > 0 ? `覆盖表有 ${normalized.problems.length} 处格式问题，已按能读的部分处理` : '',
    }
  } catch (error) {
    return { data: null, file, note: `覆盖表读取失败，已忽略：${error?.message ?? error}` }
  }
}

/**
 * Read-modify-write under the per-file queue. The mutator receives the
 * current table (empty when absent/corrupt) and returns the next one.
 *
 * A corrupt file is backed up first; the result carries the backup path so
 * the route can tell the user where their old content went.
 *
 * @param {string} file
 * @param {(data: object) => object|Promise<object>} mutator
 * @returns {Promise<{ file: string, backup: string }>}
 */
export async function updateOverride(file, mutator) {
  if (typeof mutator !== 'function') throw new TypeError('mutator must be a function')

  return serialise(file, async () => {
    let data = {}
    let backup = ''

    let raw = null
    try {
      raw = await readFile(file, 'utf8')
    } catch (error) {
      if (error?.code !== 'ENOENT') throw new Error(`覆盖表读取失败，未写入：${error?.message ?? error}`)
    }

    if (raw !== null) {
      let parsed = null
      try {
        parsed = normalizeOverride(JSON.parse(raw))
      } catch (error) {
        parsed = null
      }
      if (parsed === null) {
        backup = await backupCorrupt(file)
      } else {
        // Parseable but malformed still loses the fields the next write would
        // drop, so keep the original aside before replacing it.
        if (parsed.problems.length > 0) backup = await backupCorrupt(file)
        data = parsed.data
      }
    }

    const next = await mutator(data)
    const normalized = normalizeOverride(next)
    if (normalized === null) throw new TypeError('mutator must return an override object')

    await writeAtomic(file, normalized.data)
    return { file, backup }
  })
}

/** Replace the whole table (import). Also serialised against in-flight edits. */
export async function replaceOverride(file, data) {
  const normalized = normalizeOverride(data)
  if (normalized === null) throw new TypeError('override data must be an object')

  return serialise(file, async () => {
    await writeAtomic(file, normalized.data)
    return { file, backup: '' }
  })
}

/**
 * Keep the table that was in force before an import, so the user can undo one
 * whole plan. Only one level is kept; the next import replaces the snapshot.
 */
export async function saveUndo(file, data) {
  return replaceOverride(`${file}.undo`, data ?? {})
}

/**
 * Put the previous table back and consume the snapshot. Returns null when
 * there is nothing to undo.
 */
export async function restoreUndo(file) {
  const undoFile = `${file}.undo`
  const snapshot = await readOverride(undoFile)
  if (snapshot.data === null) return null
  await replaceOverride(file, snapshot.data)
  await rm(undoFile, { force: true })
  return snapshot.data
}
