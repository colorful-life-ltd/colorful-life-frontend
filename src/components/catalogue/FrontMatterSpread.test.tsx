// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { CategoryCatalogue } from './CategoryCatalogue'
import { curatedBackendCategories } from './catalogueData.test-utils'
import { FrontMatterContentsPage, FrontMatterWelcomePage } from './FrontMatterSpread'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('Catalogue front matter', () => {
  it('preserves the complete welcome copy as real text', () => {
    const markup = renderToStaticMarkup(<FrontMatterWelcomePage />)
    const text = markup.replace(/<[^>]*>/g, '').replaceAll('&amp;', '&')
    expect(text).toContain('Welcome to Build & Bloom')
    expect(text).toContain('Every great build begins with a little imagination.')
    expect(text).toContain('Here at Build & Bloom, we believe the joy is not only in what you build, but in the stories, adventures and memories you create along the way.')
    expect(text).toContain('So take your time, turn the pages, and see what catches your eye.')
    expect(text).toContain('There’s always something wonderful waiting to be built.')
  })

  it('offers Catalogue, Find a Set and the Customer Information chapter, with no stray legal line', () => {
    const markup = renderToStaticMarkup(<FrontMatterContentsPage onCatalogue={() => {}} onSearch={() => {}} />)
    const buttons = [...markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)]
    expect(buttons).toHaveLength(2)
    expect(buttons[0][1]).not.toContain('disabled')
    expect(buttons[0][2]).toContain('Our Catalogue')
    expect(buttons[0][2]).toContain('Explore the Build &amp; Bloom collections')
    expect(buttons[1][1]).not.toContain('disabled')
    expect(buttons[1][2]).toContain('Find a Set')
    expect(buttons[1][2]).toContain('Search by name or set number')
    expect(markup).toMatch(/href="\/help">[\s\S]*?Help &amp; FAQs/)
    expect(markup).toMatch(/href="\/legal\/delivery-returns">[\s\S]*?Delivery &amp; Returns/)
    expect(markup).toMatch(/href="\/legal\/contact">[\s\S]*?Contact Us/)
    expect(markup).toMatch(/href="\/legal\/terms">[\s\S]*?Customer Information/)
    expect(markup).not.toContain('front-matter__legal')
    expect(markup).not.toMatch(/category-entry/)
  })

  it.each(['contact', 'help'] as const)('turns to the %s information page on a plain click', slug => {
    const onLegal = vi.fn()
    const container = document.createElement('div'); document.body.append(container)
    const root = createRoot(container)
    act(() => root.render(<FrontMatterContentsPage onCatalogue={() => {}} onSearch={() => {}} onLegal={onLegal} />))
    const contact = container.querySelector<HTMLAnchorElement>(`a[href="${slug === 'help' ? '/help' : '/legal/contact'}"]`)!
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    act(() => { contact.dispatchEvent(click) })
    expect(click.defaultPrevented).toBe(true)
    expect(onLegal).toHaveBeenCalledWith(slug)
    act(() => root.unmount()); container.remove()
  })

  it('disables the contents action while a page is turning', () => {
    const markup = renderToStaticMarkup(<FrontMatterContentsPage onCatalogue={() => {}} onSearch={() => {}} turning />)
    expect(markup.match(/ disabled=""/g)).toHaveLength(2)
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(4)
  })

  it('mounts welcome and contents in the existing physical book without category duplication', () => {
    const markup = renderToStaticMarkup(<CategoryCatalogue spread="front-matter" onSpreadChange={() => {}} onClose={() => {}} backendCategoriesState={{ status: "ready", categories: curatedBackendCategories }} onRetryCategories={() => {}} />)
    expect(markup.match(/aria-label="Open catalogue book"/g)).toHaveLength(1)
    expect(markup).toContain('front-matter--welcome')
    expect(markup).toContain('front-matter--contents')
    expect(markup).toContain('← Close Book')
    expect(markup).not.toContain('class="category-entry"')
  })
})
