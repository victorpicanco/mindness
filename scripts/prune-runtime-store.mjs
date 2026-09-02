// Removes every package in a pnpm virtual store that the deployed package can
// no longer reach. `pnpm deploy --prod` keeps optional peer dependencies that
// the runtime never imports (the Prisma CLI and its Studio tree alone account
// for ~170 MB), and pnpm has no prune command. Reachability is exact here: in a
// pnpm store every dependency edge is a symlink, so a walk from the deployed
// node_modules visits precisely what Node can resolve.

import { readdirSync, realpathSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const target = process.argv[2]

if (target === undefined) {
  process.stderr.write('usage: node prune-runtime-store.mjs <deployed-package-dir>\n')
  process.exit(1)
}

const modules = join(target, 'node_modules')
const store = realpathSync(join(modules, '.pnpm'))

function resolvedLinks(directory) {
  const resolved = []
  let entries

  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    return resolved
  }

  for (const entry of entries) {
    if (entry.name === '.bin' || entry.name === '.pnpm') continue

    const path = join(directory, entry.name)

    // A scope folder is a real directory holding the links themselves.
    if (entry.name.startsWith('@') && entry.isDirectory() && !entry.isSymbolicLink()) {
      resolved.push(...resolvedLinks(path))
      continue
    }

    try {
      resolved.push(realpathSync(path))
    } catch {
      // A dangling link is already unreachable.
    }
  }

  return resolved
}

function storeEntryOf(path) {
  if (!path.startsWith(`${store}/`)) return undefined
  return path.slice(store.length + 1).split('/')[0]
}

const reachable = new Set()
const pending = resolvedLinks(modules)

while (pending.length > 0) {
  const path = pending.pop()
  const entry = storeEntryOf(path)

  if (entry === undefined || reachable.has(entry)) continue

  reachable.add(entry)
  pending.push(...resolvedLinks(join(store, entry, 'node_modules')))
}

let removed = 0

for (const entry of readdirSync(store)) {
  if (entry === 'lock.yaml' || entry === 'node_modules' || reachable.has(entry)) continue

  rmSync(join(store, entry), { recursive: true, force: true })
  removed += 1
}

process.stdout.write(`pruned ${removed} unreachable packages, kept ${reachable.size}\n`)
