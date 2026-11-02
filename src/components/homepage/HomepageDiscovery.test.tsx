import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomepageDiscovery } from './HomepageDiscovery'

describe('homepage crawlable discovery', () => {
  it('provides useful UK storefront copy and real category links', () => {
    const html = renderToStaticMarkup(<HomepageDiscovery categories={[{
      id: 'marvel', label: 'Marvel', backendId: 5, backendCategory: { id: 5, name: 'Marvel', subtitle: null, description: null, imageUrl: null, thumbnailUrl: null }, href: '/categories/marvel',
    }]} />)
    expect(html.match(/<h1\b/g)).toHaveLength(1)
    expect(html).toContain('UK seller of new LEGO® sets')
    expect(html).toContain('UK delivery')
    expect(html).toContain('href="/categories/marvel"')
    expect(html).toContain('href="/legal/delivery-returns"')
  })
})
