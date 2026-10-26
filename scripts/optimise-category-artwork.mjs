// Regenerates the category-index artwork from the full-size originals in artwork/categories/.
// The largest rendered size is ~346 px wide (2560 px desktop), so 720 px covers 2x screens.
// Usage (sharp is not a project dependency): npm i --no-save sharp && node scripts/optimise-category-artwork.mjs
import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { default: sharp } = await import(process.env.SHARP_PATH ?? 'sharp')
const root = fileURLToPath(new URL('..', import.meta.url))
const source = join(root, 'artwork/categories')
const target = join(root, 'src/assets/categories/optimised')
const WIDTH = 720 // keep in sync with OPTIMISED_CATEGORY_ARTWORK_WIDTH in src/components/catalogue/categories.ts
mkdirSync(target, { recursive: true })

for (const file of readdirSync(source).filter(name => /^category-.*\.png$/.test(name)).sort()) {
  const name = file.replace(/\.png$/, '')
  const resized = () => sharp(join(source, file)).resize({ width: WIDTH, withoutEnlargement: true, kernel: 'lanczos3' })
  await resized().webp({ quality: 86, alphaQuality: 100, effort: 6, smartSubsample: true }).toFile(join(target, `${name}.webp`))
  await resized().png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(join(target, `${name}.png`))
  const kib = path => Math.round(statSync(path).size / 1024)
  console.log(`${name}: ${kib(join(source, file))} KiB -> webp ${kib(join(target, `${name}.webp`))} KiB, png ${kib(join(target, `${name}.png`))} KiB`)
}
