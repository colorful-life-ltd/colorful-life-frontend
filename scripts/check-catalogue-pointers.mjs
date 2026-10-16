import assert from 'node:assert/strict'

/** Run with a Playwright Browser and a dedicated local Vite server. No backend/provider traffic. */
export async function checkCataloguePointers(browser, origin) {
  const base = new URL(origin)
  assert.equal(base.hostname, '127.0.0.1')
  const results = []
  const categories = ['Harry Potter', 'City', 'Disney', 'Marvel', 'DC & Batman', 'Friends', 'NINJAGO', 'Vehicles', 'Creator'].map((name, index) => ({ id: index + 1, name, subtitle: null, description: null, imageUrl: null }))
  const mockBody = pathname => JSON.stringify(pathname === '/api/categories' ? categories : pathname === '/api/products' ? { items: [], pagination: { page: 1, pageSize: 100, totalItems: 0, totalPages: 0 } } : [])
  for (const [width, height, touch] of [[1280, 720, false], [1365, 768, false], [1440, 900, false], [1024, 768, true], [820, 1180, true], [390, 844, true], [760, 900, true]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: touch, reducedMotion: 'reduce' })
    try {
      // A fresh context avoids interfering with another tester's page/session.
      await context.addInitScript(() => { Math.random = () => 0.5 })
      const page = await context.newPage()
      await page.route('**/*', route => {
        const url = new URL(route.request().url())
        if (url.origin !== base.origin) return route.abort()
        if (url.pathname.startsWith('/api/')) return route.fulfill({ contentType: 'application/json', body: mockBody(url.pathname) })
        return route.continue()
      })
      const activate = locator => touch ? locator.tap() : locator.click()
      for (const state of ['closed', 'open']) {
        await page.goto(base.origin)
        if (state === 'open') {
          await activate(page.getByRole('button', { name: 'Open Build & Bloom catalogue', exact: true }))
          await page.locator('.opening-transition').waitFor({ state: 'detached' })
        }
        const account = width <= 760 ? page.getByRole('button', { name: 'Account', exact: true }) : page.getByRole('button', { name: 'Open your account', exact: true })
        // No force, DOM click, or keyboard workaround: normal browser hit testing.
        await activate(account)
        await page.locator('.account-modal').waitFor({ state: 'visible', timeout: 3000 })
        results.push({ width, height, touch, action: `${state} account`, passed: true })
      }
      if (width > 760) {
        for (let index = 0; index < 6; index++) {
          await page.goto(base.origin)
          await page.waitForTimeout(100)
          const bookmark = page.locator('.closed-catalogue .city-bookmark').nth(index)
          const href = await bookmark.getAttribute('href')
          const box = await bookmark.boundingBox()
          assert.ok(box)
          // Start on the exposed bookmark tip; its clipped area isn't a pointer target.
          if (index === 0) {
            // Exercise the exposed bookmark strip that overlaps the cover edge.
            if (touch) await bookmark.tap({ position: { x: box.width * 0.735, y: box.height / 2 } })
            else await page.mouse.click(box.x + box.width * 0.735, box.y + box.height / 2)
          } else if (!touch) {
            await page.mouse.move(box.x + box.width * 0.95, box.y + box.height / 2)
            await page.waitForTimeout(270)
            await bookmark.click()
          } else {
            await bookmark.tap({ position: { x: box.width * 0.95, y: box.height / 2 } })
          }
          await page.waitForURL(url => url.pathname === href, { timeout: 3000 })
          assert.equal(await page.locator('main').getAttribute('data-book-state'), 'open')
          results.push({ width, height, touch, action: `bookmark ${index + 1}`, passed: true })
        }
      } else {
        await page.goto(base.origin)
        for (const bookmark of await page.locator('.closed-catalogue .city-bookmark').all()) assert.equal(await bookmark.isVisible(), false)
      }
    } catch (error) {
      throw new Error(`Pointer regression at ${width}x${height}, touch=${touch}, completed=${JSON.stringify(results)}: ${error.message}`)
    } finally {
      await context.close()
    }
  }
  // Exercise the real animation separately from reduced-motion interaction checks.
  const context = await browser.newContext({ viewport: { width: 1365, height: 768 } })
  try {
    const page = await context.newPage()
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (url.origin !== base.origin) return route.abort()
      return url.pathname.startsWith('/api/') ? route.fulfill({ contentType: 'application/json', body: mockBody(url.pathname) }) : route.continue()
    })
    await page.goto(base.origin)
    await page.getByRole('button', { name: 'Open Build & Bloom catalogue', exact: true }).click()
    await page.locator('.opening-transition').waitFor({ state: 'detached' })
    assert.equal(await page.locator('main').getAttribute('data-book-state'), 'open')
    results.push({ action: 'normal cover animation', passed: true })
  } finally { await context.close() }
  return results
}
