// Asserts what `npm pack` would ship: everything the runtime needs, nothing
// from the development tree. Run by CI and by `node tools/check-pack.mjs`.
import { spawnSync } from 'node:child_process'

const REQUIRED = [
  'package.json',
  'index.js',
  'client.js',
  'lib/compose.js',
  'lib/capabilities.js',
  'lib/usage.js',
  'lib/usage-cache.js',
  'lib/skills-snapshot.js',
  'lib/override.js',
  'lib/translate.js',
  'taxonomy.json',
  'cordis.patch.yml',
  'locale/en.json',
  'locale/zh.json',
  'icon.svg',
  'README.md',
  'LICENSE',
]

const FORBIDDEN = [/^test\//, /^tools\//, /^docs\//, /^\.github\//, /^\.scratch\//, /^\.shots\//, /^src\//, /^scripts\//]

const result = spawnSync('npm pack --dry-run --json', {
  encoding: 'utf8',
  shell: true,
})

if (result.status !== 0) {
  console.error('npm pack failed:')
  console.error(result.stderr || result.stdout)
  process.exit(1)
}

let parsed
try {
  parsed = JSON.parse(result.stdout)
} catch (error) {
  console.error('could not parse `npm pack --json` output:', error.message)
  process.exit(1)
}

const files = (parsed[0]?.files ?? []).map((file) => file.path)
const problems = []

for (const required of REQUIRED) {
  if (!files.includes(required)) problems.push(`missing from the package: ${required}`)
}
for (const path of files) {
  if (FORBIDDEN.some((pattern) => pattern.test(path))) problems.push(`development file would be published: ${path}`)
}

if (problems.length > 0) {
  console.error(`package contents have ${problems.length} problem(s):`)
  for (const problem of problems) console.error(`  - ${problem}`)
  process.exit(1)
}

console.log(`package contents ok — ${files.length} files, ${REQUIRED.length} required present`)
