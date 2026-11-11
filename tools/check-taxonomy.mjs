// Validates taxonomy.json: shape, unique ids, ordering, and that every skill
// entry names a situation that exists. Run by CI and by `node tools/check-taxonomy.mjs`.
import { readFile } from 'node:fs/promises'

const file = new URL('../taxonomy.json', import.meta.url)
const raw = await readFile(file, 'utf8')

let data
try {
  data = JSON.parse(raw)
} catch (error) {
  console.error(`taxonomy.json is not valid JSON: ${error.message}`)
  process.exit(1)
}

const problems = []

if (typeof data.version !== 'number') problems.push('version must be a number')

if (!Array.isArray(data.situations) || data.situations.length === 0) {
  problems.push('situations must be a non-empty array')
}

const ids = new Set()
const orders = new Set()
for (const [index, situation] of (data.situations ?? []).entries()) {
  const where = `situations[${index}]`
  if (typeof situation?.id !== 'string' || situation.id === '') {
    problems.push(`${where}.id must be a non-empty string`)
    continue
  }
  if (ids.has(situation.id)) problems.push(`${where}: duplicate id "${situation.id}"`)
  ids.add(situation.id)
  if (typeof situation.title !== 'string' || situation.title === '') {
    problems.push(`${where}.title must be a non-empty string`)
  }
  if (typeof situation.titleEn !== 'string' || situation.titleEn === '') {
    problems.push(`${where}.titleEn must be a non-empty string`)
  }
  if (typeof situation.order !== 'number') {
    problems.push(`${where}.order must be a number`)
  } else if (orders.has(situation.order)) {
    problems.push(`${where}: duplicate order ${situation.order}`)
  } else {
    orders.add(situation.order)
  }
}

if (!ids.has('other')) problems.push('a situation with id "other" is required as the fallback')

if (data.skills === null || typeof data.skills !== 'object' || Array.isArray(data.skills)) {
  problems.push('skills must be an object keyed by skill name')
} else {
  for (const [name, entry] of Object.entries(data.skills)) {
    const where = `skills["${name}"]`
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problems.push(`${where} must be an object`)
      continue
    }
    if (!ids.has(entry.situation)) {
      problems.push(`${where}.situation "${entry.situation}" is not a declared situation`)
    }
    if (entry.trigger !== undefined && (typeof entry.trigger !== 'string' || entry.trigger.trim() === '')) {
      problems.push(`${where}.trigger must be a non-empty string when present`)
    }
    if (entry.zh !== undefined && (typeof entry.zh !== 'string' || entry.zh.trim() === '')) {
      problems.push(`${where}.zh must be a non-empty string when present`)
    }
    if (entry.repo !== undefined && (typeof entry.repo !== 'string' || !/^https?:\/\//.test(entry.repo))) {
      problems.push(`${where}.repo must be an http(s) URL when present`)
    }
  }
}

if (problems.length > 0) {
  console.error(`taxonomy.json has ${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

const covered = Object.keys(data.skills ?? {}).length
console.log(`taxonomy.json ok — ${ids.size} situations, ${covered} skills mapped`)
