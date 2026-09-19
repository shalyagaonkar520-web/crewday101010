/**
 * Ticket identifiers.
 *
 * Two distinct values per registration:
 *
 *  - `registrationCode` — short, human readable, printed on the ticket
 *    (`CD-2026-8F4A92`). Safe to show; guessing it alone does nothing.
 *  - `qrToken` — 160 bits of CSPRNG entropy, encoded in the QR only. Check-in
 *    requires a token match, so a photographed ticket *code* cannot be forged
 *    into a scan, and the QR itself carries no personal information.
 */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // no I, L, O, U — unambiguous

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function randomString(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (const byte of bytes) out += CROCKFORD[byte % CROCKFORD.length]
  return out
}

/** e.g. `CD-2026-8F4A92` */
export function generateRegistrationCode(date = new Date()): string {
  return `CD-${date.getFullYear()}-${randomString(6)}`
}

/** 32 chars of Crockford base32 ≈ 160 bits. */
export function generateQrToken(): string {
  return `CDREG-${randomString(32)}`
}

/** Payload actually encoded in the QR image. Contains no personal data. */
export function buildQrPayload(registrationId: string, qrToken: string): string {
  return `CDQR1|${registrationId}|${qrToken}`
}

export interface ParsedQrPayload {
  registrationId: string
  qrToken: string
}

/**
 * Parse a scanned string. Returns null for anything that is not a CrewDay
 * ticket, so the scanner can show "invalid" without touching Firestore.
 */
export function parseQrPayload(raw: string): ParsedQrPayload | null {
  const value = raw.trim()
  const parts = value.split('|')
  if (parts.length !== 3 || parts[0] !== 'CDQR1') return null
  const [, registrationId, qrToken] = parts
  if (!registrationId || !qrToken || !qrToken.startsWith('CDREG-')) return null
  return { registrationId, qrToken }
}

/** Stable, URL-safe document id for a user supplied interest name. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}
