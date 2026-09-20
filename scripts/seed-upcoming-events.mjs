#!/usr/bin/env node
/**
 * Publish CrewDay's real upcoming events.
 *
 *   node scripts/seed-upcoming-events.mjs --email admin@crewday.app --password '...'
 *   node scripts/seed-upcoming-events.mjs --email ... --password ... --undo
 *
 * Same mechanics as seed-demo-events.mjs: it signs in as an organiser and
 * writes through the Firestore REST API with that user's ID token, so it goes
 * through the same security rules as the admin panel. Each event's document id
 * is a slug of its title, so running it twice updates rather than duplicates,
 * and `--undo` removes exactly these events and nothing else.
 *
 * Poster images are not uploaded here: add them from Admin -> Events -> Edit.
 */

import { readFileSync } from 'node:fs'

/* ------------------------------- Arguments ------------------------------- */

const args = process.argv.slice(2)
const argOf = (name) => {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? undefined : args[index + 1]
}
const UNDO = args.includes('--undo')
const email = argOf('email') ?? process.env.CREWDAY_ADMIN_EMAIL
const password = argOf('password') ?? process.env.CREWDAY_ADMIN_PASSWORD

if (!email || !password) {
  console.error(
    'Usage: node scripts/seed-upcoming-events.mjs --email <organiser email> --password <password> [--undo]',
  )
  process.exit(1)
}

/* --------------------------- Firebase config ----------------------------- */

function readEnvLocal() {
  const config = {}
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const match = line.match(/^\s*(VITE_[A-Z_]+)\s*=\s*(.*)\s*$/)
    if (match) config[match[1]] = match[2].trim()
  }
  return config
}

const env = readEnvLocal()
const API_KEY = env.VITE_FIREBASE_API_KEY
const PROJECT = env.VITE_FIREBASE_PROJECT_ID
if (!API_KEY || !PROJECT) {
  console.error('Missing VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID in .env.local')
  process.exit(1)
}
const DOCS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

/* --------------------------------- Dates --------------------------------- */

/** Local calendar date, not UTC, so a Sunday stays a Sunday in IST. */
const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** The next Sunday strictly after today. */
function nextSunday() {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  let delta = (7 - date.getDay()) % 7
  if (delta === 0) delta = 7
  date.setDate(date.getDate() + delta)
  return iso(date)
}

/* ------------------------------ Search tokens ----------------------------- */

// Mirrors `buildSearchTokens` in src/services/eventService.ts.
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'this', 'that', 'a', 'an', 'of', 'at', 'in'])

function buildSearchTokens({ title, venue, category, city, area, tags = [] }) {
  const source = [title, venue, category, city, area, ...tags].join(' ').toLowerCase()
  const words = source.split(/[^a-z0-9]+/).filter((word) => word.length > 1 && !STOP_WORDS.has(word))
  const tokens = new Set()
  for (const word of words) {
    tokens.add(word)
    for (let size = 3; size <= Math.min(word.length, 12); size += 1) tokens.add(word.slice(0, size))
  }
  return [...tokens].slice(0, 260)
}

// Mirrors `slugify` in src/utils/ids.ts.
const slugify = (value) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

/* --------------------------------- Events -------------------------------- */

const VENUE = {
  venue: 'Absolutely Chill Place',
  address: 'Neeladri Nagar, Electronic City Phase 1, Bengaluru 560100',
  city: 'Bengaluru',
  area: 'Neeladri Nagar',
}

// The posters say "Sunday (date will be shared soon)": the events go up on the
// coming Sunday so they show as upcoming, and the description says the exact
// date is still to be confirmed. Change `date` here or in the admin panel once
// it is fixed.
const EVENTS = [
  {
    title: 'Sunday Jam Circle',
    description:
      'Guitarists, singers & beginners jam.\n\nBring your guitar. Bring your voice. Or just come, chill, listen & meet people who love music.\n\nNo experience required. Play, sing, meet, chill.\n\nSunday evening at Absolutely Chill Place, Neeladri Nagar. Exact date will be shared soon.\n\nSame passion. New friends.',
    category: 'Music',
    date: nextSunday(),
    startTime: '17:00',
    endTime: '19:30',
    ...VENUE,
    capacity: 40,
    price: 0,
    eventTypes: ['both'],
    featured: true,
    tags: ['guitar', 'singing', 'beginners welcome', 'jam', 'no experience required'],
  },
  {
    title: 'Open Mic: No Judgement',
    description:
      'Singing, poetry, comedy, storytelling.\n\nAll voices welcome. Just be you. Take the mic for a song, a poem, a bit or a story, or come to listen and cheer everyone on.\n\nSunday evening at Absolutely Chill Place, Neeladri Nagar. Exact date will be shared soon.\n\nBring your talent. Meet new people.',
    category: 'Singing',
    date: nextSunday(),
    startTime: '18:00',
    endTime: '21:00',
    ...VENUE,
    capacity: 60,
    price: 0,
    eventTypes: ['both'],
    featured: true,
    tags: ['open mic', 'singing', 'poetry', 'comedy', 'storytelling', 'all voices welcome'],
  },
  {
    title: 'Talk Without Filters',
    description:
      'Fun conversation topics, no formal networking.\n\nLaugh & meet: come for the comedy, stay for the people. Stand-up comedy, comedy games, random conversations, chai & snacks, and new people to meet.\n\nSunday evening at Absolutely Chill Place, Neeladri Nagar. Exact date will be shared soon.\n\nNew faces. Good vibes. Real conversations. See you there!',
    category: 'Other',
    date: nextSunday(),
    startTime: '17:00',
    endTime: '20:00',
    ...VENUE,
    capacity: 50,
    price: 0,
    eventTypes: ['both'],
    featured: true,
    tags: ['comedy', 'stand-up', 'conversations', 'chai', 'meet new people', 'no networking'],
  },
]

/* ------------------------------ REST helpers ----------------------------- */

const str = (value) => ({ stringValue: value ?? '' })
const int = (value) => ({ integerValue: String(value) })
const bool = (value) => ({ booleanValue: Boolean(value) })
const arr = (values) => ({ arrayValue: { values } })
const ts = (value) => ({ timestampValue: value })

async function signIn() {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  )
  const data = await response.json()
  if (!data.idToken) {
    throw new Error(`Sign-in failed: ${data.error?.message ?? 'unknown error'}`)
  }
  return { token: data.idToken, uid: data.localId }
}

function toFirestoreFields(event, uid) {
  const startsAt = new Date(`${event.date}T${event.startTime}:00`)
  const weekday = new Date(`${event.date}T00:00:00`).getDay()
  const now = new Date().toISOString()

  return {
    title: str(event.title),
    description: str(event.description),
    imageURL: str(''),
    imagePath: str(''),
    category: str(event.category),
    date: str(event.date),
    startTime: str(event.startTime),
    endTime: str(event.endTime ?? ''),
    startsAt: ts(startsAt.toISOString()),
    weekday: int(weekday),
    isFree: bool(event.price <= 0),
    searchTokens: arr(buildSearchTokens(event).map(str)),
    venue: str(event.venue),
    address: str(event.address),
    city: str(event.city),
    area: str(event.area),
    mapsURL: str(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue} ${event.area} ${event.city}`)}`,
    ),
    capacity: int(event.capacity),
    price: int(event.price),
    currency: str('INR'),
    eventTypes: arr(event.eventTypes.map(str)),
    status: str('open'),
    featured: bool(event.featured),
    waitlistEnabled: bool(true),
    tags: arr((event.tags ?? []).map(str)),
    registeredCount: int(0),
    participantCount: int(0),
    audienceCount: int(0),
    checkedInCount: int(0),
    waitlistCount: int(0),
    createdBy: str(uid),
    createdAt: ts(now),
    updatedAt: ts(now),
  }
}

/* ---------------------------------- Main --------------------------------- */

const { token, uid } = await signIn()
console.log(`Signed in as ${email}`)
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }

if (UNDO) {
  for (const event of EVENTS) {
    const response = await fetch(`${DOCS}/events/${slugify(event.title)}`, {
      method: 'DELETE',
      headers,
    })
    console.log(`${response.ok ? 'removed ' : 'FAILED  '} ${event.title}`)
  }
  process.exit(0)
}

for (const event of EVENTS) {
  const id = slugify(event.title)
  // PATCH creates the document when it is missing and replaces it when it
  // exists, so the script is safe to re-run after editing an event above.
  // Counters are only written on first creation so re-running never resets
  // registrations.
  const existing = await fetch(`${DOCS}/events/${id}`, { headers })
  const fields = toFirestoreFields(event, uid)
  const counterFields = [
    'registeredCount',
    'participantCount',
    'audienceCount',
    'checkedInCount',
    'waitlistCount',
    'createdAt',
    'createdBy',
  ]
  const updateMask = existing.ok
    ? Object.keys(fields).filter((field) => !counterFields.includes(field))
    : Object.keys(fields)
  const query = updateMask.map((field) => `updateMask.fieldPaths=${field}`).join('&')

  const response = await fetch(`${DOCS}/events/${id}?${query}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  })

  if (response.ok) {
    console.log(`${existing.ok ? 'updated ' : 'created '} ${event.title.padEnd(28)} ${event.date}  ${event.startTime}  FREE`)
  } else {
    const error = await response.json().catch(() => ({}))
    console.error(`FAILED   ${event.title}: ${error.error?.message ?? response.status}`)
    process.exitCode = 1
  }
}

console.log('\nAdd the posters from Admin -> Events -> Edit -> Cover image.')
