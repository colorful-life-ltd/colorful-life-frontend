import { useEffect } from 'react'
import { absoluteUrl, type RouteHead } from './routeHead'

const JSON_LD_ID = 'route-structured-data'

function upsert(selector: string, create: () => HTMLElement, attribute: string, value: string | null) {
  let element = document.head.querySelector<HTMLElement>(selector)
  if (value === null) { element?.remove(); return }
  if (!element) { element = create(); document.head.appendChild(element) }
  element.setAttribute(attribute, value)
}

const meta = (key: 'name' | 'property', name: string) => () => {
  const element = document.createElement('meta')
  element.setAttribute(key, name)
  return element
}

/**
 * Updates the static index.html tags in place. React 19 hoisting would append
 * duplicate description/canonical tags beside the no-JavaScript fallbacks.
 */
export function applyRouteHead(head: RouteHead, structuredData: readonly object[] = []) {
  if (typeof document === 'undefined') return
  document.title = head.title
  const canonical = head.canonicalPath === null ? null : absoluteUrl(head.canonicalPath)
  upsert('meta[name="description"]', meta('name', 'description'), 'content', head.description)
  upsert('meta[name="robots"]', meta('name', 'robots'), 'content', head.robots)
  upsert('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', canonical)
  upsert('meta[property="og:title"]', meta('property', 'og:title'), 'content', head.title)
  upsert('meta[property="og:description"]', meta('property', 'og:description'), 'content', head.description)
  upsert('meta[property="og:url"]', meta('property', 'og:url'), 'content', canonical)
  const json = structuredData.length ? JSON.stringify(structuredData.length === 1 ? structuredData[0] : structuredData).replace(/</g, '\\u003c') : null
  let script = document.getElementById(JSON_LD_ID)
  if (json === null) { script?.remove(); return }
  if (!script) {
    script = Object.assign(document.createElement('script'), { id: JSON_LD_ID, type: 'application/ld+json' })
    document.head.appendChild(script)
  }
  script.textContent = json
}

/** A null head leaves the document untouched so a nested owner can manage it. */
export function useRouteHead(head: RouteHead | null, structuredData: readonly object[] = []) {
  const key = JSON.stringify([head, structuredData])
  useEffect(() => {
    if (head) applyRouteHead(head, structuredData)
    // The serialized key captures every value the head depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
}
