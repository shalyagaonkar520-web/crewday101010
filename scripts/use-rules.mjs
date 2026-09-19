#!/usr/bin/env node
/**
 * Switch which rule files `firebase.json` points at.
 *
 *   node scripts/use-rules.mjs dev    -> firestore.rules.dev  / storage.rules.dev
 *   node scripts/use-rules.mjs prod   -> firestore.rules      / storage.rules
 *
 * Kept as an explicit, visible switch rather than an environment flag so that
 * "which rules are live?" is answerable by reading one file in the repo.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const MODES = {
  dev: { firestore: 'firestore.rules.dev', storage: 'storage.rules.dev' },
  prod: { firestore: 'firestore.rules', storage: 'storage.rules' },
}

const mode = process.argv[2]
const target = MODES[mode]

if (!target) {
  console.error('Usage: node scripts/use-rules.mjs <dev|prod>')
  process.exit(1)
}

for (const file of Object.values(target)) {
  if (!existsSync(file)) {
    console.error(`Missing rules file: ${file}`)
    process.exit(1)
  }
}

const config = JSON.parse(readFileSync('firebase.json', 'utf8'))
config.firestore.rules = target.firestore
config.storage.rules = target.storage
writeFileSync('firebase.json', `${JSON.stringify(config, null, 2)}\n`)

if (mode === 'dev') {
  console.log('\n  ⚠  firebase.json now points at WIDE OPEN development rules.')
  console.log('     Anyone with the public API key can read and write everything.')
  console.log('     Run `npm run rules:prod` before this app is publicly reachable.\n')
} else {
  console.log('\n  ✓  firebase.json now points at the locked-down production rules.\n')
}
