// Writes static HTML for every public sitemap route into dist/prerendered/ after `vite build`.
// dist/index.html is left as the app shell; nginx serves prerendered/<path>/index.html (see docs/seo-prerendering.md).
// The catalogue comes from the committed snapshot (scripts/catalogue-snapshot.mjs);
// HTML and dist/sitemap.xml are generated from that one snapshot.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import react from '@vitejs/plugin-react'
import { build } from 'vite'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
// Inside node_modules so the SSR bundle resolves react/react-dom from this project.
const work = join(root, 'node_modules/.cache/prerender')

/** Compiles src/prerender/site.tsx with the app's own toolchain; no SSR server or extra dependency. */
export async function loadSite() {
  rmSync(work, { recursive: true, force: true })
  await build({
    configFile: false, root, logLevel: 'warn', plugins: [react()],
    build: { ssr: 'src/prerender/site.tsx', outDir: work, emptyOutDir: true, rollupOptions: { output: { entryFileNames: 'site.mjs' } } },
  })
  return import(pathToFileURL(join(work, 'site.mjs')).href)
}

export function readSnapshot(path = join(root, 'src/prerender/catalogue-snapshot.json')) {
  const snapshot = JSON.parse(readFileSync(path, 'utf8'))
  if (snapshot.version !== 1 || !Array.isArray(snapshot.products) || !Array.isArray(snapshot.categories) || !Array.isArray(snapshot.sitemapUrls)) throw Error('Invalid catalogue snapshot')
  return snapshot
}

export function siteOriginFromEnv(value = process.env.VITE_SITE_URL) {
  if (!/^https:\/\/[a-z0-9.-]+$/.test(value ?? '')) throw Error('VITE_SITE_URL must be an https origin without a path')
  return value
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const origin = siteOriginFromEnv()
  const template = readFileSync(join(dist, 'index.html'), 'utf8')
  const files = (await loadSite()).renderSite(readSnapshot(), template, origin)
  for (const [name, content] of Object.entries(files)) {
    const target = join(dist, name)
    if (existsSync(target)) throw Error(`Prerender would overwrite ${name}`)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
  rmSync(work, { recursive: true, force: true })
  console.log(`Prerendered ${Object.keys(files).length - 2} public routes, 404.html and sitemap.xml into dist/prerendered`)
}
