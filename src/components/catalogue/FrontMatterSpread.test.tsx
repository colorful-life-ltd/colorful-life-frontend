import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CategoryCatalogue } from './CategoryCatalogue'
import { curatedBackendCategories } from './catalogueData.test-utils'
import { FrontMatterContentsPage, FrontMatterWelcomePage } from './FrontMatterSpread'

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

  it('offers Catalogue, Find a Set and the live help chapters, with the rest unavailable and legal links quiet', () => {
    const markup = renderToStaticMarkup(<FrontMatterContentsPage onCatalogue={() => {}} onSearch={() => {}} />)
    const buttons = [...markup.matchAll(/<button([^>]*)>([\s\S]*?)<\/button>/g)]
    expect(buttons).toHaveLength(3)
    expect(buttons[0][1]).not.toContain('disabled')
    expect(buttons[0][2]).toContain('Our Catalogue')
    expect(buttons[0][2]).toContain('Explore the Build &amp; Bloom collections')
    expect(buttons[1][1]).not.toContain('disabled')
    expect(buttons[1][2]).toContain('Find a Set')
    expect(buttons[1][2]).toContain('Search by name or set number')
    expect(buttons[2][1]).toContain('disabled')
    expect(buttons[2][2]).toContain('Help &amp; FAQs')
    expect(markup).toMatch(/<a class="front-matter__entry" href="\/legal\/delivery-returns">[\s\S]*Delivery &amp; Returns/)
    expect(markup).toMatch(/<a class="front-matter__entry" href="mailto:support@build-and-bloom\.co\.uk">[\s\S]*Contact Us/)
    for (const href of ['/legal/privacy', '/legal/cookies', '/legal/terms']) expect(markup).toContain(`href="${href}"`)
    expect(markup).not.toMatch(/category-entry/)
  })

  it('disables the contents action while a page is turning', () => {
    const markup = renderToStaticMarkup(<FrontMatterContentsPage onCatalogue={() => {}} onSearch={() => {}} turning />)
    expect(markup.match(/ disabled=""/g)).toHaveLength(3)
    expect(markup.match(/aria-disabled="true"/g)).toHaveLength(2)
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
