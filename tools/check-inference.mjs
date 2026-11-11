// Checks the situation inference used for skills that `taxonomy.json` does not
// list. Run by CI and by `node tools/check-inference.mjs`.
import { inferSituation } from '../index.js'

const cases = [
  ['excel-writer', 'Write your results into an xlsx spreadsheet', 'docs'],
  ['bug-hunter', 'Debug and patch failing tests in a legacy module', 'code'],
  ['chart-maker', 'Draw a diagram of the architecture', 'design'],
  ['pr-reviewer', 'Review the pull request before merge', 'review'],
  ['deep-dive', 'Investigate the literature and survey prior work', 'research'],
  ['onboarding', 'Teach me this concept with a tutorial', 'learn'],
  ['cordis-helper', 'Configure a cordis plugin preset', 'harness'],
  ['zh-weekly', '写周报并整理成文档', 'docs'],
  ['random-widget', 'Does something entirely unrelated', null],
]

const failures = []
for (const [name, description, expected] of cases) {
  const actual = inferSituation(name, description)
  const ok = actual === expected
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name} → ${actual} (expected ${expected})`)
  if (!ok) failures.push({ name, expected, actual })
}

if (failures.length > 0) {
  console.error(`\n${failures.length} inference case(s) failed`)
  process.exit(1)
}
console.log(`\ninference ok — ${cases.length} cases`)
