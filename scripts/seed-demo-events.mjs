#!/usr/bin/env node
/**
 * Seed a set of demo events so the app has something to show.
 *
 *   node scripts/seed-demo-events.mjs --email admin@crewday.app --password '...'
 *   node scripts/seed-demo-events.mjs --email ... --password ... --undo
 *
 * It signs in as a real organiser account and writes through the Firestore
 * REST API with that user's ID token, so it goes through the same security
 * rules as the admin panel — it works under the locked-down rules too, and it
 * cannot do anything an organiser could not do by hand.
 *
 * Every seeded event carries `demoSeed: true`, which is what `--undo` deletes.
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
    'Usage: node scripts/seed-demo-events.mjs --email <organiser email> --password <password> [--undo]',
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

/**
 * Local calendar date, not UTC. `toISOString()` would shift midnight IST back
 * to the previous day and put every "Sunday" event on a Saturday.
 */
const iso = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** The Nth upcoming occurrence of a weekday (0 = Sunday). */
function nextWeekday(weekday, occurrence = 1) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  let delta = (weekday - date.getDay() + 7) % 7
  if (delta === 0) delta = 7
  date.setDate(date.getDate() + delta + (occurrence - 1) * 7)
  return iso(date)
}

function inDays(days) {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return iso(date)
}

/* ------------------------------ Search tokens ----------------------------- */

// Mirrors `buildSearchTokens` in src/services/eventService.ts. Kept in sync by
// hand; if the tokenizer there changes, change it here too.
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

/* ------------------------------- Demo events ------------------------------ */

/**
 * Topical demo photography.
 *
 * LoremFlickr serves a Creative Commons photo matching the given tags, and
 * `lock` pins one specific image so an event does not change picture on every
 * load. Random stock (picsum) put a mountain on a guitar jam.
 *
 * Real events should have an image uploaded through the admin panel; this is
 * only for seeded demo data.
 */
const IMG = (tags, lock) => `https://loremflickr.com/800/500/${tags}?lock=${lock}`

const EVENTS = [
  {
    title: 'Sunday Guitar Jam',
    description:
      'Bring your guitar, bring a song, bring nothing at all.\n\nAn easy, open circle for anyone who plays — acoustic, electric, three chords or three hundred. We run a loose round-robin: whoever wants to play, plays. Everyone else listens, claps and joins in on the chorus.\n\nBeginners genuinely welcome. Spare guitars available.',
    category: 'Music',
    date: nextWeekday(0, 1),
    startTime: '17:00',
    endTime: '19:30',
    venue: 'The Hive, Electronic City',
    address: '1st Cross, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 50,
    price: 0,
    eventTypes: ['both'],
    featured: true,
    tags: ['acoustic', 'beginners welcome', 'open circle'],
    image: 'guitar,acoustic', lock: 11,
  },
  {
    title: 'Sunrise Trek: Nandi Hills',
    description:
      'Out of the city by 4am, on the ridge before the sun is.\n\nA steady 4km climb with one properly good view at the top. Transport from Hebbal included, plus breakfast at a filter-coffee place on the way back.\n\nModerate fitness needed. Bring a windcheater — it is colder than you think up there.',
    category: 'Travel',
    date: nextWeekday(6, 1),
    startTime: '04:30',
    endTime: '11:00',
    venue: 'Pickup: Infosys Gate 1',
    address: 'Hosur Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 24,
    price: 499,
    eventTypes: ['participant'],
    featured: true,
    tags: ['trekking', 'sunrise', 'transport included'],
    image: 'trekking,sunrise', lock: 12,
  },
  {
    title: 'Badminton Doubles Night',
    description:
      'Four courts, rotating doubles, no egos.\n\nWe reshuffle partners every two games so you play with everyone. Rackets available if you do not own one. Shuttles provided.\n\nIntermediate level — you should be able to rally.',
    category: 'Sports',
    date: inDays(3),
    startTime: '19:00',
    endTime: '21:00',
    venue: 'Play Factory Arena',
    address: 'Neeladri Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 16,
    price: 0,
    eventTypes: ['participant'],
    tags: ['badminton', 'doubles', 'rackets provided'],
    image: 'badminton,sport', lock: 13,
  },
  {
    title: 'Street Photography Walk',
    description:
      'Three hours through the market with a camera in your hand.\n\nWe walk slowly, shoot a lot and stop for chai halfway. A working photographer comes along to nudge you on framing and light.\n\nAny camera counts, including your phone. We finish with a quick review of everyone’s five favourite frames.',
    category: 'Photography',
    date: nextWeekday(0, 1),
    startTime: '07:00',
    endTime: '10:00',
    venue: 'Electronic City Lake Park',
    address: 'Doddathoguru, Electronic City, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 20,
    price: 0,
    eventTypes: ['both'],
    tags: ['photowalk', 'street', 'phone cameras welcome'],
    image: 'photography,street', lock: 14,
  },
  {
    title: 'Open Mic: Poetry & Song',
    description:
      'Eight minutes, one mic, whatever you have got.\n\nPoetry, stand-up, a song you wrote last Tuesday. Sign-ups open at the door and we go in order.\n\nComing only to listen is completely fine — half the room does exactly that, and the room is the whole point.',
    category: 'Music',
    date: inDays(5),
    startTime: '19:30',
    endTime: '22:00',
    venue: 'Cafe Noir, Neo Town',
    address: 'Neo Town Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 70,
    price: 0,
    eventTypes: ['both'],
    featured: true,
    tags: ['open mic', 'poetry', 'spoken word'],
    image: 'openmic,microphone', lock: 15,
  },
  {
    title: 'Sunday Football 7s',
    description:
      'Seven-a-side on turf, two hours, rolling subs.\n\nTeams get picked on the day so it stays balanced. Bibs and ball provided; bring boots and your own water.\n\nWe play through unless it properly pours.',
    category: 'Sports',
    date: nextWeekday(0, 2),
    startTime: '07:00',
    endTime: '09:00',
    venue: 'Turf Town Electronic City',
    address: 'Konappana Agrahara, Electronic City, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 28,
    price: 199,
    eventTypes: ['participant'],
    tags: ['football', 'turf', '7-a-side'],
    image: 'football,turf', lock: 16,
  },
  {
    title: 'Diwali CrewDay',
    description:
      'The big one. Lights, food, music and roughly two hundred people who did not want to spend the festival alone.\n\nLive acoustic sets through the evening, a proper spread, and a rangoli corner that always ends up more competitive than intended.\n\nBring family. Bring your flatmates. Bring the friend who never comes out.',
    category: 'Festival',
    date: nextWeekday(6, 3),
    startTime: '19:00',
    endTime: '23:00',
    venue: 'Velankani Tech Park Grounds',
    address: 'Velankani Dr, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 200,
    price: 199,
    eventTypes: ['both'],
    featured: true,
    tags: ['diwali', 'festival', 'live music', 'family friendly'],
    image: 'diwali,festival', lock: 17,
  },
  {
    title: 'Board Game Night',
    description:
      'Thirty games on the shelf, someone who knows the rules for all of them.\n\nCatan, Codenames, Wingspan, Azul and a heavy euro or two for the people who want that. We match you to a table by how long you want to play.\n\nCome alone — you will not stay alone.',
    category: 'Gaming',
    date: inDays(2),
    startTime: '18:30',
    endTime: '22:00',
    venue: 'Brew & Board',
    address: 'Neeladri Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 32,
    price: 0,
    eventTypes: ['participant'],
    tags: ['board games', 'catan', 'come alone'],
    image: 'boardgame,tabletop', lock: 18,
  },
  {
    title: 'Beginner Salsa Social',
    description:
      'One hour of teaching, two hours of dancing.\n\nWe start with the basic step and a simple turn pattern, rotate partners constantly, then open the floor. No partner needed and no experience assumed — this is genuinely the absolute beginner session.\n\nWear shoes you can pivot in.',
    category: 'Dance',
    date: nextWeekday(6, 2),
    startTime: '18:00',
    endTime: '21:00',
    venue: 'Studio Beats, Neo Town',
    address: 'Neo Town Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 40,
    price: 299,
    eventTypes: ['both'],
    tags: ['salsa', 'no partner needed', 'absolute beginner'],
    image: 'salsa,dancing', lock: 19,
  },
  {
    title: 'Cycling: Turahalli Loop',
    description:
      'Thirty-five kilometres out to the forest and back, at a pace that waits for everyone.\n\nWe regroup at every major turn, so this works whether you ride weekly or dug the bike out yesterday. One coffee stop.\n\nHelmet mandatory. Bring lights — we roll out before sunrise.',
    category: 'Fitness',
    date: nextWeekday(0, 2),
    startTime: '05:45',
    endTime: '09:00',
    venue: 'Start: Infosys Gate 1',
    address: 'Hosur Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 30,
    price: 0,
    eventTypes: ['participant'],
    tags: ['cycling', 'no drop ride', 'helmet mandatory'],
    image: 'cycling,bicycle', lock: 20,
  },
  {
    title: 'Pottery Workshop: Throw a Bowl',
    description:
      'Clay, a wheel, and three hours to make something you can eat out of.\n\nSmall group so everyone gets real wheel time and real attention. All materials included, and we fire and glaze your piece for collection two weeks later.\n\nYou will get messy. Wear something you do not love.',
    category: 'Art',
    date: nextWeekday(0, 3),
    startTime: '10:00',
    endTime: '13:00',
    venue: 'Clay Cafe Electronic City',
    address: '7th Main, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 12,
    price: 999,
    eventTypes: ['participant'],
    tags: ['pottery', 'materials included', 'small group'],
    image: 'pottery,ceramics', lock: 21,
  },
  {
    title: 'Book Club: Science Fiction',
    description:
      'This month: a short novel everyone can finish in a week.\n\nWe spend the first half on the book and the second half arguing about whether the ending earned itself. Having not quite finished it is a long-standing tradition.\n\nThe title goes out to everyone who registers.',
    category: 'Books',
    date: nextWeekday(0, 3),
    startTime: '16:00',
    endTime: '18:00',
    venue: 'Page Turners, Neo Town',
    address: 'Neo Town Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 18,
    price: 0,
    eventTypes: ['both'],
    tags: ['book club', 'sci-fi', 'monthly'],
    image: 'books,cafe', lock: 22,
  },
  {
    title: 'Karaoke Night: Sing Your Heart Out',
    description: `Twelve thousand songs and a room that claps for everyone.

Bollywood, rock, nineties pop, that one song you only sing in the shower. No judging, no auditions, and a tambourine for anybody too shy to take the mic.

Come in a group or come alone and leave in a group.`,
    category: 'Singing',
    date: nextWeekday(5, 1),
    startTime: '20:00',
    endTime: '23:30',
    venue: 'The Hive, Electronic City',
    address: '1st Cross, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 60,
    price: 0,
    eventTypes: ['both'],
    featured: true,
    tags: ['karaoke', 'singing', 'no judging'],
    image: 'karaoke,microphone', lock: 23,
  },
  {
    title: 'Saturday DJ Night: Afro House',
    description: `Four hours of afro house and melodic techno on a proper sound system.

Two residents back to back until midnight, then an open-format close. Dark room, good bass, no photos on the floor.

Over 21s. Dress how you like, dance how you like.`,
    category: 'DJ',
    date: nextWeekday(6, 1),
    startTime: '21:00',
    endTime: '01:00',
    venue: 'Basement 21',
    address: 'Neeladri Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 120,
    price: 499,
    eventTypes: ['audience'],
    featured: true,
    tags: ['dj', 'afro house', 'techno', '21+'],
    image: 'dj,nightclub', lock: 24,
  },
  {
    title: 'Bollywood Dance Party',
    description: `A one-hour crash course in four filmi routines, then the floor opens and nobody sits down again.

Absolutely no experience needed — that is the entire point. The choreographer breaks everything down to counts and we go slowly until the room has it.

Wear something you can move in.`,
    category: 'Dance',
    date: nextWeekday(0, 1),
    startTime: '18:00',
    endTime: '21:00',
    venue: 'Studio Beats, Neo Town',
    address: 'Neo Town Rd, Electronic City Phase 1, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 45,
    price: 299,
    eventTypes: ['both'],
    tags: ['bollywood', 'beginners welcome', 'choreography'],
    image: 'dance,bollywood', lock: 25,
  },
  {
    title: 'Rooftop Sundowner Party',
    description: `Sunset, a rooftop, a playlist that behaves itself until about nine.

Snacks included, drinks at the bar, and enough space to actually talk to people. The kind of evening where you arrive knowing one person and leave with six numbers.

Weather permitting — we move indoors if it rains.`,
    category: 'Party',
    date: nextWeekday(6, 2),
    startTime: '17:30',
    endTime: '22:00',
    venue: 'Skyline Rooftop',
    address: 'Electronic City Phase 2, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 80,
    price: 799,
    eventTypes: ['both'],
    featured: true,
    tags: ['rooftop', 'sundowner', 'snacks included'],
    image: 'party,rooftop', lock: 26,
  },
  {
    title: 'FIFA & Mario Kart Tournament',
    description: `Two brackets, two screens, one trophy nobody will admit they want.

Single elimination for FIFA, four-player chaos for Mario Kart. Controllers provided, snacks on the house, and a losers bracket so one bad round does not end your night.

Sign-ups close when the bracket fills.`,
    category: 'Gaming',
    date: nextWeekday(0, 2),
    startTime: '15:00',
    endTime: '20:00',
    venue: 'Player 1 Lounge',
    address: 'Electronic City Phase 2, Bengaluru 560100',
    city: 'Bengaluru',
    area: 'Electronic City',
    capacity: 32,
    price: 199,
    eventTypes: ['both'],
    tags: ['fifa', 'mario kart', 'tournament'],
    image: 'videogame,console', lock: 27,
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
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue} ${event.city}`)}`,
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
    demoSeed: bool(true),
    createdBy: str(uid),
    createdAt: ts(now),
    updatedAt: ts(now),
  }
}

async function listSeeded(token) {
  const response = await fetch(`${DOCS}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'events' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'demoSeed' },
            op: 'EQUAL',
            value: { booleanValue: true },
          },
        },
      },
    }),
  })
  const rows = await response.json()
  if (!Array.isArray(rows)) return []
  return rows
    .filter((row) => row.document)
    .map((row) => ({
      path: row.document.name,
      title: row.document.fields?.title?.stringValue ?? '(untitled)',
    }))
}

/* ---------------------------------- Main --------------------------------- */

const { token, uid } = await signIn()
console.log(`Signed in as ${email}`)

if (UNDO) {
  const existing = await listSeeded(token)
  if (!existing.length) {
    console.log('Nothing to remove — no demo events found.')
    process.exit(0)
  }
  for (const event of existing) {
    const response = await fetch(`https://firestore.googleapis.com/v1/${event.path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    console.log(`${response.ok ? 'removed ' : 'FAILED  '} ${event.title}`)
  }
  console.log(`\nDone. Removed ${existing.length} demo event(s).`)
  process.exit(0)
}

const existingTitles = new Set((await listSeeded(token)).map((event) => event.title))
let created = 0
let skipped = 0

for (const event of EVENTS) {
  if (existingTitles.has(event.title)) {
    console.log(`skipped  ${event.title} (already seeded)`)
    skipped += 1
    continue
  }

  const response = await fetch(`${DOCS}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ fields: toFirestoreFields(event, uid) }),
  })

  if (response.ok) {
    console.log(
      `created  ${event.title.padEnd(34)} ${event.date}  ${event.price === 0 ? 'FREE' : `₹${event.price}`}`,
    )
    created += 1
  } else {
    const error = await response.json().catch(() => ({}))
    console.error(`FAILED   ${event.title}: ${error.error?.message ?? response.status}`)
  }
}

console.log(`\nDone. ${created} created, ${skipped} skipped.`)
console.log('Remove them again with the same command plus --undo')
