/**
 * Pure composition for the dashboard payload: no IO, no host services, no
 * clock. Same input, same output — which is what makes the whole thing
 * testable without a browser or a live DSH.
 */

export const FALLBACK_SITUATIONS = [{ id: 'other', title: '其他', order: 999 }]

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
 * Turn a raw catalog plus a taxonomy into exactly what the Client renders.
 * @param {{ skills: object[], taxonomy?: { situations?: object[], skills?: object } }} input
 */
export function composeDashboard({ skills, taxonomy }) {
  const situations = [...(taxonomy?.situations ?? FALLBACK_SITUATIONS)].sort((a, b) => a.order - b.order)
  const known = new Set(situations.map((situation) => situation.id))

  const labelled = (skills ?? [])
    .map((skill) => labelSkill(skill, taxonomy, known))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    situations: situations.map((situation) => ({ id: situation.id, title: situation.title, order: situation.order })),
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
