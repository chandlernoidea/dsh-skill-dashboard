/**
 * Model-backed translation for the descriptions a beginner cannot read.
 *
 * Nothing here touches a session or the consent decision: the Host route owns
 * the consent gate, this module owns the prompt, the stream, the parse and the
 * on-disk cache. It accepts an `llm` port so tests never call a real model.
 *
 * Cost is explicit: one short request per batch, a hard skill cap, and a cache
 * keyed by the exact source text so re-opening the panel sends nothing again.
 */

import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const MAX_SKILLS = 24
export const BATCH_SIZE = 4
const MAX_TEXT = 400
const QUEUES = new Map()
let temporaryCounter = 0

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Stable, short fingerprint of the text that was sent. */
export function sourceHash(skill) {
  return createHash('sha256')
    .update(`${skill.name}\n${skill.description ?? ''}\n${skill.whenToUse ?? ''}`)
    .digest('hex')
    .slice(0, 16)
}

/**
 * Skills that need a fresh translation: non-empty description, no current
 * cache entry for the exact source text.
 */
export function pendingSkills(skills, cache) {
  return (skills ?? []).filter((skill) => {
    if (!isPlainObject(skill)) return false
    if (typeof skill.name !== 'string' || skill.name === '') return false
    if (typeof skill.description !== 'string' || skill.description.trim() === '') return false
    const entry = cache?.[skill.name]
    return !isPlainObject(entry) || entry.hash !== sourceHash(skill) || typeof entry.zh !== 'string' || entry.zh === ''
  })
}

/** Only the cached entries whose source text still matches. */
export function translationsFor(skills, cache) {
  const out = {}
  for (const skill of skills ?? []) {
    const entry = cache?.[skill.name]
    if (!isPlainObject(entry)) continue
    if (entry.hash !== sourceHash(skill)) continue
    if (typeof entry.zh === 'string' && entry.zh !== '') out[skill.name] = entry.zh
  }
  return out
}

export function buildPrompt(skills) {
  const lines = [
    'Translate the descriptions of DSH skills into Simplified Chinese for a beginner.',
    'Keep product names, commands, paths, code identifiers and file names unchanged.',
    'Only output a JSON array. Each item is {"name":"<exact skill name>","zh":"<one or two short Chinese sentences>"}.',
    'Do not use Markdown fences. Do not explain or reason. Keep each zh under 80 Chinese characters.',
    '',
  ]
  for (const skill of skills) {
    lines.push(`name: ${skill.name}`)
    lines.push(`description: ${String(skill.description ?? '').slice(0, MAX_TEXT)}`)
    if (skill.whenToUse) lines.push(`whenToUse: ${String(skill.whenToUse).slice(0, MAX_TEXT)}`)
  }
  return lines.join('\n')
}

export function estimateChars(skills) {
  return buildPrompt(skills ?? []).length
}

function stripFences(text) {
  return String(text ?? '').replace(/```(?:json)?/gi, '').trim()
}

function parseEntries(text, names) {
  const allowed = new Set(names ?? [])
  const body = stripFences(text)
  const start = body.indexOf('[')
  const end = body.lastIndexOf(']')
  let parsed = null

  if (start >= 0 && end > start) {
    parsed = JSON.parse(body.slice(start, end + 1))
  } else {
    const objectStart = body.indexOf('{')
    const objectEnd = body.lastIndexOf('}')
    if (objectStart < 0 || objectEnd <= objectStart) throw new Error('模型返回的翻译格式无法解析')
    parsed = JSON.parse(body.slice(objectStart, objectEnd + 1))
  }

  const out = {}
  const add = (name, zhValue) => {
    if (typeof name !== 'string' || name === '') return
    if (allowed.size > 0 && !allowed.has(name)) return
    if (typeof zhValue !== 'string') return
    const zh = zhValue.trim()
    if (zh === '') return
    out[name] = zh.slice(0, 200)
  }

  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      if (!isPlainObject(item)) continue
      add(item.name, item.zh ?? item.translation)
    }
  } else if (isPlainObject(parsed)) {
    for (const [name, value] of Object.entries(parsed)) {
      if (isPlainObject(value)) add(name, value.zh ?? value.translation)
      else add(name, value)
    }
  } else {
    throw new Error('模型返回的翻译格式无法解析')
  }

  return out
}

/**
 * Parse the model's JSON. Accepts an array of {name, zh} and an object map;
 * entries for names that were not requested are ignored.
 *
 * @param {string} text
 * @param {Iterable<string>} names
 * @returns {Record<string, string>}
 */
export function parseTranslations(text, names) {
  return parseEntries(text, names)
}

/**
 * One short model request for one batch. The stream is assembled from
 * `text-delta` chunks; a non-stop finish is an error, never a partial result.
 *
 * @param {{ llm: object, target: {provider: string, model: string}, sessionId?: string, skills: object[], signal?: AbortSignal, maxTokens?: number }} input
 */
export async function translateBatch({ llm, target, sessionId, skills, signal, maxTokens = 4096, reasoningEffort }) {
  if (!llm || typeof llm.stream !== 'function') throw new Error('模型服务不可用')
  if (!target || typeof target.provider !== 'string' || typeof target.model !== 'string') {
    throw new Error('当前会话没有选中模型')
  }
  if (!Array.isArray(skills) || skills.length === 0) return {}
  return runTranslation({ llm, target, sessionId, skills, signal, maxTokens, reasoningEffort })
}

function isTruncated(kind) {
  return kind === 'max-tokens' || kind === 'length' || kind === 'max_output_tokens'
}

async function runTranslation({ llm, target, sessionId, skills, signal, maxTokens, reasoningEffort }) {
  const messages = [
    {
      role: 'system',
      content: [{ type: 'text', text: 'You are a translation engine. Output only the requested JSON array; do not reason, explain, or use Markdown.' }],
    },
    { role: 'user', content: [{ type: 'text', text: buildPrompt(skills) }] },
  ]
  const options = {
    provider: target.provider,
    model: target.model,
    messages,
    maxTokens,
    ...(typeof reasoningEffort === 'string' && reasoningEffort !== '' ? { reasoningEffort } : {}),
    ...(typeof sessionId === 'string' && sessionId !== '' ? { sessionId } : {}),
    purpose: 'skill-dashboard-translate',
    ...(signal ? { signal } : {}),
  }

  let text = ''
  let finishKind = ''
  for await (const chunk of llm.stream(options)) {
    if (chunk?.type === 'text-delta') text += chunk.text ?? ''
    else if (chunk?.type === 'finish') {
      const reason = chunk.reason
      finishKind = typeof reason === 'string' ? reason : reason?.kind ?? ''
    }
  }

  const split = async () => {
    const middle = Math.ceil(skills.length / 2)
    const left = await runTranslation({ llm, target, sessionId, skills: skills.slice(0, middle), signal, maxTokens, reasoningEffort })
    const right = await runTranslation({ llm, target, sessionId, skills: skills.slice(middle), signal, maxTokens, reasoningEffort })
    return { ...left, ...right }
  }

  let zh = null
  try {
    zh = parseTranslations(text, skills.map((skill) => skill.name))
  } catch (error) {
    // A cut-off JSON body is the usual max-token symptom: halve the batch and
    // ask again before surfacing an error to the user.
    if (isTruncated(finishKind) && skills.length > 1) return split()
    if (isTruncated(finishKind)) throw new Error(`模型输出被截断（${finishKind}），可减少技能数后重试`)
    throw error
  }

  if (Object.keys(zh).length === 0) {
    if (isTruncated(finishKind) && skills.length > 1) return split()
    if (finishKind && finishKind !== 'stop') throw new Error(`模型返回未完成（${finishKind}）`)
    throw new Error('模型没有返回可用的翻译')
  }

  // Parseable output wins even for an unfamiliar finish kind; only a known
  // truncation with multiple skills is worth splitting to recover the rest.
  if (isTruncated(finishKind) && skills.length > 1) return split()
  return zh
}

/** Read the cache; a missing or corrupt cache is simply empty. */
export async function readTranslationCache(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return isPlainObject(parsed) ? parsed : {}
  } catch (error) {
    return {}
  }
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

/**
 * Merge new translations under the per-file queue, so two panel tabs cannot
 * lose each other's cache entries. Atomic temp + rename.
 */
export function removeTranslations(cache, names) {
  if (!isPlainObject(cache)) return {}
  if (names === undefined || names === null) return {}
  const next = { ...cache }
  for (const name of names) {
    if (typeof name === 'string' && name !== '') delete next[name]
  }
  return next
}

async function writeCache(file, next) {
  await mkdir(dirname(file), { recursive: true })
  temporaryCounter += 1
  const temporary = `${file}.${process.pid}.${Date.now()}.${temporaryCounter}.tmp`
  try {
    await writeFile(temporary, JSON.stringify(next, null, 2) + '\n', 'utf8')
    await rename(temporary, file)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => {})
    throw error
  }
  return next
}

/** Forget one or more translations; omitted names clear the whole cache. */
export async function forgetTranslations(file, names) {
  return serialise(file, async () => {
    const current = await readTranslationCache(file)
    return writeCache(file, removeTranslations(current, names))
  })
}

export async function mergeTranslationCache(file, additions) {
  return serialise(file, async () => {
    const current = await readTranslationCache(file)
    const next = { ...current, ...(additions ?? {}) }
    return writeCache(file, next)
  })
}
