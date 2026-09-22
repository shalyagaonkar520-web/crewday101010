#!/usr/bin/env node
/**
 * Generate the source images that `@capacitor/assets` expands into every
 * Android launcher-icon and splash-screen density.
 *
 *   node scripts/make-app-assets.mjs
 *   npx @capacitor/assets generate --android
 *
 * Both run together as `npm run android:assets`.
 *
 * Everything is derived from `public/crewday-mark.svg`, so the app icon can
 * never drift from the logo on the website. Output goes to `assets/`, which is
 * the directory @capacitor/assets reads by convention:
 *
 *   icon.png             1024  legacy (pre-Android 8) launcher icon
 *   icon-foreground.png  1024  adaptive icon foreground, safe-zone padded
 *   icon-background.png  1024  adaptive icon background, flat brand tint
 *   splash.png           2732  light splash
 *   splash-dark.png      2732  dark splash
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const MARK = 'public/crewday-mark.svg'
const OUT = 'assets'

/** Brand surfaces, matching `--color-brand-*` in src/index.css. */
const LIGHT = '#fdf7fb'
const DARK = '#141a23'
const PINK = '#ff4d8d'

/**
 * Android crops an adaptive icon to a circle, squircle or rounded square
 * depending on the launcher, and only the middle 66% is guaranteed visible.
 * The mark therefore occupies 60% of the foreground, centred, with the rest
 * transparent.
 */
const ADAPTIVE_SAFE_FRACTION = 0.6

async function render(svg, size) {
  return sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toBuffer()
}

function canvas(size, background) {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const svg = await readFile(MARK, 'utf8')

  // Legacy icon: the mark nearly fills a brand-tinted square, because Android
  // applies its own mask to this one.
  const legacySize = 1024
  const legacyMark = await render(svg, Math.round(legacySize * 0.86))
  const legacy = await canvas(legacySize, LIGHT)
    .composite([{ input: legacyMark, gravity: 'center' }])
    .png()
    .toBuffer()
  await writeFile(`${OUT}/icon.png`, legacy)

  // Adaptive foreground: same mark, smaller, on transparency.
  const foregroundMark = await render(svg, Math.round(1024 * ADAPTIVE_SAFE_FRACTION))
  const foreground = await canvas(1024, { r: 0, g: 0, b: 0, alpha: 0 })
    .composite([{ input: foregroundMark, gravity: 'center' }])
    .png()
    .toBuffer()
  await writeFile(`${OUT}/icon-foreground.png`, foreground)

  // Adaptive background: flat, so the launcher's parallax never reveals an edge.
  await writeFile(`${OUT}/icon-background.png`, await canvas(1024, LIGHT).png().toBuffer())

  // Splash: one square, centre-cropped by Capacitor to whatever the screen is,
  // so the mark stays well inside the middle third.
  const splashSize = 2732
  const splashMark = await render(svg, Math.round(splashSize * 0.22))
  for (const [name, background] of [
    ['splash.png', LIGHT],
    ['splash-dark.png', DARK],
  ]) {
    await writeFile(
      `${OUT}/${name}`,
      await canvas(splashSize, background)
        .composite([{ input: splashMark, gravity: 'center' }])
        .png()
        .toBuffer(),
    )
  }

  console.log(`Wrote icon, adaptive icon and splash sources to ${OUT}/ (brand ${PINK})`)
}

await main()
