/**
 * Pure composition for the dashboard payload: no IO, no host services, no
 * clock. Same input, same output — which is what makes the whole thing
 * testable without a browser or a live DSH.
 */

export const FALLBACK_SITUATIONS = [{ id: 'other', title: '其他', titleEn: 'Other', order: 999 }]

const EMPTY_TAXONOMY = { version: 0, situations: FALLBACK_SITUATIONS, skills: {} }

// Situation inference for skills that `taxonomy.json` does not list — a user
// who installs their own skills still gets them sorted. Order = first strong
// match wins; otherwise the most keyword hits decides.
const STRONG_RULES = [
  [/pptx|docx|xlsx|spreadsheet|幻灯片|表格/i, 'docs'],
  [/blender|drawai|diagram|canvas|文字成片|视频/i, 'design'],
  [/\btdd\b|单元测试/i, 'code'],
  [/cordis|harness|sandbox|沙箱/i, 'harness'],
]

const SITUATION_RULES = [
  { id: 'docs', re: /(office|pdf|readme|handoff|spec\b|ticket|questionnaire|document|report|文档|工单|规格|报告)/gi },
  { id: 'design', re: /(diagram|chart|draw|video|motion|render|image|svg|图|画布|建模|出图)/gi },
  { id: 'review', re: /(review|audit|critique|triage|lint|grill|审查|评审|复盘|把关)/gi },
  { id: 'research', re: /(research|investigate|survey|literature|search|调研|检索|查证)/gi },
  { id: 'learn', re: /(teach|learn|tutorial|explain|course|学习|教程|讲解)/gi },
  { id: 'harness', re: /(plugin|cordis|harness|sandbox|preset|hook|config|插件|配置)/gi },
  { id: 'code', re: /(code|bug|debug|refactor|test|implement|build|compile|patch|feature|代码|重构|测试|实现|修复)/gi },
]

export function inferSituation(name, description) {
  const text = `${name} ${description}`
  for (const [re, id] of STRONG_RULES) if (re.test(text)) return id
  let best = null
  for (const rule of SITUATION_RULES) {
    const hits = (text.match(rule.re) || []).length
    if (hits > 0 && (best === null || hits > best.hits)) best = { id: rule.id, hits }
  }
  return best !== null && best.hits >= 1 ? best.id : null
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeTaxonomy(value) {
  if (!isPlainObject(value)) return null
  const situations = Array.isArray(value.situations) ? value.situations.filter(isPlainObject) : []
  const skills = isPlainObject(value.skills) ? value.skills : {}
  return { version: typeof value.version === 'number' ? value.version : 0, situations, skills }
}

/**
 * Layer a user's override table over the packaged defaults.
 *
 * Overrides can add situations and override skills, never remove them: an
 * entry the package ships stays visible even if the user's file says nothing
 * about it, so a half-written override file cannot wipe the dashboard.
 * Invalid or partially invalid input is ignored field by field.
 */
export function mergeTaxonomy(defaults, override) {
  const base = sanitizeTaxonomy(defaults) ?? EMPTY_TAXONOMY
  const extra = sanitizeTaxonomy(override)
  if (extra === null) return base

  const situations = [...base.situations]
  const indexById = new Map(situations.map((situation, index) => [situation.id, index]))
  for (const situation of extra.situations) {
    if (typeof situation.id !== 'string' || situation.id === '') continue
    const index = indexById.get(situation.id)
    if (index === undefined) {
      situations.push(situation)
      indexById.set(situation.id, situations.length - 1)
    } else {
      situations[index] = { ...situations[index], ...situation }
    }
  }

  const skills = { ...base.skills }
  for (const [name, entry] of Object.entries(extra.skills)) {
    if (!isPlainObject(entry)) continue
    skills[name] = { ...(skills[name] ?? {}), ...entry }
  }

  return { ...base, situations, skills }
}

function pickTitle(situation, language) {
  const zh = typeof situation.title === 'string' && situation.title !== '' ? situation.title : situation.id
  const en = typeof situation.titleEn === 'string' && situation.titleEn !== '' ? situation.titleEn : zh
  return String(language || '').toLowerCase().startsWith('zh') ? zh : en
}

function labelSkill(skill, taxonomy, knownSituations) {
  const entry = taxonomy?.skills?.[skill.name] ?? null
  if (entry !== null) {
    return {
      ...skill,
      situation: knownSituations.has(entry.situation) ? entry.situation : 'other',
      situationSource: 'taxonomy',
      trigger: typeof entry.trigger === 'string' ? entry.trigger : '',
      zh: typeof entry.zh === 'string' ? entry.zh : '',
      repo: typeof entry.repo === 'string' ? entry.repo : '',
    }
  }
  const inferred = inferSituation(skill.name, skill.description ?? '')
  return {
    ...skill,
    situation: inferred ?? 'other',
    situationSource: inferred === null ? 'unmapped' : 'heuristic',
    trigger: '',
    zh: '',
    repo: '',
  }
}

/**
 * Turn a raw catalog plus a taxonomy (and an optional user override) into
 * exactly what the Client renders.
 * @param {{ skills: object[], taxonomy?: object, override?: object|undefined, language?: string }} input
 */
export function composeDashboard({ skills, taxonomy, override, language }) {
  const merged = mergeTaxonomy(taxonomy, override)
  const situations = [...merged.situations].sort((a, b) => a.order - b.order)
  const known = new Set(situations.map((situation) => situation.id))

  const labelled = (skills ?? [])
    .map((skill) => labelSkill(skill, merged, known))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    situations: situations.map((situation) => ({
      id: situation.id,
      title: pickTitle(situation, language),
      order: situation.order,
    })),
    counts: {
      total: labelled.length,
      manual: labelled.filter((skill) => skill.modelInvocable === false).length,
      files: labelled.filter((skill) => skill.path).length,
      registry: labelled.filter((skill) => !skill.path).length,
      unmapped: labelled.filter((skill) => skill.situation === 'other').length,
    },
    skills: labelled,
  }
}
