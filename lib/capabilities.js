/**
 * Which host capabilities this plugin leans on, and what their absence means.
 * Pure: the host probes, this decides what to tell the user.
 */

export const CAPABILITIES = [
  {
    id: 'sessionSkillCatalog',
    label: '会话技能目录',
    labelEn: 'Session skill catalog',
    role: 'catalog',
  },
  {
    id: 'skills',
    label: '技能服务',
    labelEn: 'Skill service',
    role: 'catalog',
  },
  {
    id: 'sessions',
    label: '会话服务',
    labelEn: 'Session store',
    role: 'aux',
  },
  {
    id: 'translator',
    label: '翻译服务',
    labelEn: 'Translation provider',
    role: 'aux',
  },
]

/**
 * @param {Record<string, boolean>|undefined} report - one entry per capability id
 * @returns {{ catalogOk: boolean, fatal: boolean, missing: Array<{id: string, label: string, labelEn: string, role: string}> }}
 */
export function summarizeAvailability(report) {
  const missing = CAPABILITIES.filter((capability) => report?.[capability.id] !== true).map(
    ({ id, label, labelEn, role }) => ({ id, label, labelEn, role }),
  )
  // The catalog is what the dashboard is FOR: without either source there is
  // nothing to draw. Anything else degrades one button, not the page.
  const catalogOk = report?.sessionSkillCatalog === true || report?.skills === true
  return { catalogOk, fatal: !catalogOk, missing }
}
