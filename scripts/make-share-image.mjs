#!/usr/bin/env node
/**
 * Build the 1200x630 card that WhatsApp, LinkedIn, Slack and Google show when a
 * CrewDay link is shared.
 *
 *   npm run seo:share-image
 *
 * The emblem comes from public/crewday-mark.svg so the card can never drift
 * from the logo. Output: public/og/crewday-share.png (kept under 300 KB).
 */
import { mkdir, readFile, stat } from 'node:fs/promises'
import sharp from 'sharp'

const W = 1200
const H = 630
const OUT = 'public/og/crewday-share.png'

const mark = await sharp(await readFile('public/crewday-mark.svg'), { density: 300 })
  .resize({ width: 300, height: 300, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

// Same brand surfaces as the splash screen in index.html.
const background = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <radialGradient id="bg" cx="0.22" cy="0.35" r="1">
      <stop offset="0" stop-color="#f6efff"/>
      <stop offset="0.55" stop-color="#eadcff"/>
      <stop offset="1" stop-color="#f6d6ec"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1080" cy="560" r="230" fill="#ef5d8f" opacity="0.10"/>
  <circle cx="1140" cy="90" r="120" fill="#8b6ae6" opacity="0.12"/>
</svg>`

const text = `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <style>
    .name { font: 800 120px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; fill: #2d2a4a; letter-spacing: 6px; }
    .line { font: 700 42px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; fill: #2d2a4a; }
    .sub  { font: 600 36px 'Segoe UI', 'Helvetica Neue', Arial, sans-serif; fill: #6b6690; }
  </style>
  <text x="470" y="270" class="name">CrewDay</text>
  <text x="474" y="360" class="line">Meet new people in Bengaluru</text>
  <text x="474" y="425" class="sub">Small, friendly events from ₹49</text>
  <text x="474" y="520" class="sub">crewday.nirmaansolutions.in</text>
</svg>`

await mkdir('public/og', { recursive: true })
await sharp(Buffer.from(background))
  .composite([
    { input: mark, left: 110, top: 165 },
    { input: Buffer.from(text), left: 0, top: 0 },
  ])
  .png({ palette: true, quality: 90, compressionLevel: 9 })
  .toFile(OUT)

const { size } = await stat(OUT)
console.log(`${OUT}: ${W}x${H}, ${(size / 1024).toFixed(0)} KB`)
if (size > 300 * 1024) {
  console.error('Share image is over 300 KB')
  process.exit(1)
}
