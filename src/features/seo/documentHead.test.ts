// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import shell from '../../../index.html?raw'
import { applyRouteHead } from './documentHead'

const staticHead = new DOMParser().parseFromString(shell, 'text/html').head.innerHTML
const count = (selector: string) => document.head.querySelectorAll(selector).length

describe('document head synchronisation', () => {
  beforeEach(() => { document.head.innerHTML = staticHead })

  it('does not give every deep link the homepage canonical before JavaScript resolves its route', () => {
    expect(count('link[rel="canonical"]')).toBe(0)
    expect(count('meta[property="og:url"]')).toBe(0)
  })

  it.each(['/', '/products/14988', '/categories/marvel', '/categories/marvel?page=1', '/legal/contact'])('resolves exactly one canonical and social URL from the real shared shell for %s', path => {
    const head = { title: 'Resolved route', description: 'Resolved description', canonicalPath: path, robots: 'index,follow' as const }
    applyRouteHead(head)
    applyRouteHead(head)
    expect(count('link[rel="canonical"]')).toBe(1)
    expect(count('meta[property="og:url"]')).toBe(1)
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${location.origin}${path}`)
    expect(document.querySelector('meta[property="og:url"]')!.getAttribute('content')).toBe(`${location.origin}${path}`)
  })

  it('updates the static index.html tags in place instead of duplicating them', () => {
    applyRouteHead({ title: 'Vehicles | Build & Bloom', description: 'Cars', canonicalPath: '/categories/vehicles', robots: 'index,follow' })
    applyRouteHead({ title: 'City | Build & Bloom', description: 'Streets', canonicalPath: '/categories/city', robots: 'index,follow' })
    expect(document.title).toBe('City | Build & Bloom')
    expect(count('title')).toBe(1)
    expect(count('meta[name="description"]')).toBe(1)
    expect(count('link[rel="canonical"]')).toBe(1)
    expect(document.head.querySelector('meta[name="description"]')!.getAttribute('content')).toBe('Streets')
    expect(document.head.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${location.origin}/categories/city`)
    expect(document.head.querySelector('meta[property="og:url"]')!.getAttribute('content')).toBe(`${location.origin}/categories/city`)
    expect(document.head.querySelector('meta[property="og:title"]')!.getAttribute('content')).toBe('City | Build & Bloom')
  })

  it('removes the canonical and og:url and sets noindex for private pages', () => {
    applyRouteHead({ title: 'Product', description: 'D', canonicalPath: '/products/1', robots: 'index,follow' })
    applyRouteHead({ title: 'Checkout', description: 'D', canonicalPath: null, robots: 'noindex,nofollow' })
    expect(count('link[rel="canonical"]')).toBe(0)
    expect(count('meta[property="og:url"]')).toBe(0)
    expect(document.head.querySelector('meta[name="robots"]')!.getAttribute('content')).toBe('noindex,nofollow')
  })

  it('adds, replaces and removes route structured data safely', () => {
    const head = { title: 'T', description: 'D', canonicalPath: '/products/1', robots: 'index,follow' as const }
    applyRouteHead(head, [{ name: '</script><script>alert(1)</script>' }])
    const script = document.head.querySelector('script[type="application/ld+json"]')!
    expect(script.textContent).not.toContain('</script>')
    expect(JSON.parse(script.textContent!)).toEqual({ name: '</script><script>alert(1)</script>' })
    applyRouteHead(head, [{ a: 1 }, { b: 2 }])
    expect(count('script[type="application/ld+json"]')).toBe(1)
    expect(JSON.parse(document.head.querySelector('script[type="application/ld+json"]')!.textContent!)).toEqual([{ a: 1 }, { b: 2 }])
    applyRouteHead(head)
    expect(count('script[type="application/ld+json"]')).toBe(0)
  })
})
