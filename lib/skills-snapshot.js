/**
 * Remember which skills were present last time the user acknowledged the
 * catalog. `/data` diffs the live catalog against this snapshot; the snapshot
 * only advances when the user clicks "got it", so a new badge cannot disappear
 * on the next 30-second poll.
 *
 * Corrupt or missing snapshots are treated as "no previous state": the next
 * load initializes the snapshot instead of reporting the whole catalog as new.
 */

import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

let temporaryCounter = 0

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalise(skill) {
  return {
    name: typeof skill?.name === 'string' ? skill.name : '',
    source: typeof skill?.source === 'string' ? skill.source : '',
    path: typeof skill?.path === 'string' ? skill.path : '',
  }
}

export function snapshotSkills(skills) {
  return (skills ?? [])
    .filter((skill) => typeof skill?.name === 'string' && skill.name !== '')
    .map(normalise)
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** @returns {{ added: object[], removed: object[] }} */
export function diffSkills(previous, current) {
  const before = new Map((previous ?? []).filter((skill) => skill?.name).map((skill) => [skill.name, skill]))
  const after = new Map((current ?? []).filter((skill) => skill?.name).map((skill) => [skill.name, skill]))
  const added = [...after.values()]
    .filter((skill) => !before.has(skill.name))
    .map(normalise)
    .sort((a, b) => a.name.localeCompare(b.name))
  const removed = [...before.values()]
    .filter((skill) => !after.has(skill.name))
    .map(normalise)
    .sort((a, b) => a.name.localeCompare(b.name))
  return { added, removed }
}

/** @returns {Promise<object[]|null>} null means no usable previous state. */
export async function readSkillsSnapshot(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (!isPlainObject(parsed) || !Array.isArray(parsed.skills)) return null
    return parsed.skills.filter((skill) => isPlainObject(skill) && typeof skill.name === 'string')
  } catch (error) {
    return null
  }
}

export async function writeSkillsSnapshot(file, skills) {
  await mkdir(dirname(file), { recursive: true })
  temporaryCounter += 1
  const temporary = `${file}.${process.pid}.${Date.now()}.${temporaryCounter}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ version: 1, at: Date.now(), skills: snapshotSkills(skills) }, null, 2) + '\n', 'utf8')
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
}
