// Assemble the host-served Client from the readable fragments in src/client.
//
// The host loads `client.js` as one module with no bundler, so the fragments
// are not imports: they share the `factory(require)` scope and are concatenated
// in filename order. This keeps the runtime contract (one file) while letting a
// human edit a 40-line section instead of a 1700-line one.
//
// `--check` verifies the committed client.js matches the fragments; CI runs it
// so a forgotten build cannot ship a stale Client.
import { readFile, readdir, writeFile } from 'node:fs/promises'

const directory = new URL('../src/client/', import.meta.url)
const target = new URL('../client.js', import.meta.url)
const fragments = (await readdir(directory)).filter((name) => name.endsWith('.js')).sort()
const parts = await Promise.all(fragments.map((name) => readFile(new URL(name, directory), 'utf8')))
const built = parts.join('')

if (process.argv.includes('--check')) {
  const current = await readFile(target, 'utf8')
  if (current !== built) {
    console.error('client.js is stale: the fragments in src/client/ no longer match it.')
    console.error('Run `npm run build` and commit the result.')
    process.exit(1)
  }
  console.log(`client.js in sync — ${fragments.length} fragments, ${built.length} bytes`)
} else {
  await writeFile(target, built, 'utf8')
  console.log(`client.js built — ${fragments.length} fragments, ${built.length} bytes`)
}
