# Build & Bloom — SEO, GEO and organic acquisition audit

Observed 4 November 2026, approximately 20:33–20:44 UTC. Live domain: https://build-and-bloom.co.uk.
Frontend baseline: `43ff3083ac5971c5892cdbf5477fbc69ab2db61e` (main/PR #108).
Backend source inspected: `45b97a4583449864ae33e11555a3abec2401feaf`.
Infra source inspected: `f39e5463594910b89d26d287371cf9c31e94ad00`.
Source identities do not independently establish current running Backend/Infra identity.

## Verdict and boundaries

**No confirmed P0 global indexing block. Significant P1 discovery/rendering weaknesses remain.** Public HTML is fetchable, the sitemap is valid and rendering produces useful product content. This is not evidence that Google has indexed the pages, selected the intended canonicals or will rank them. Search Console access was unavailable.

The storefront is a client-rendered catalogue with working links and metadata after rendering, not yet a reliably extractable HTML product catalogue. Its homepage explanation and full product directory are visually clipped. Mobile artwork transfer is a measurable weakness. Treat the current site as technically crawlable with qualifications, not organic-acquisition ready.

No AWS/DB/checkout/authentication/payment changes, financial requests, merges or deployments. Existing dirty worktrees were preserved. Open Frontend PR #96 and Backend security/payment work were inspected for scope only. This branch touches SEO metadata/tests and this evidence package; no contact with Claude or claim that Claude reviewed these changes. Security changes and protection of private routes remain with that workstream.

## Live evidence

The accompanying `seo-evidence-2026-11-04.json` records HTTP results, representative rendered product/category observations and lab measurements. Checks used ordinary unauthenticated GETs, XML parsing, Chromium DOM inspection/screenshots and public catalogue data. No bot impersonation or authenticated access.

| Check | Observation | Assessment |
|---|---|---|
| HTTPS and host variants | HTTP apex → 308 HTTPS apex; HTTP/HTTPS www → 301 HTTPS apex, one hop. `/products/14988?x=1` retained on www redirect. TLS verified by HTTP client. | Working on sampled URLs; no DNS/TLS changes needed. |
| Sitemap | 200 `application/xml; charset=utf-8`; parsed 79 unique apex-HTTPS URLs: 56 products, 15 categories, homepage + 7 help/legal pages. All 79 returned 200. Product IDs exactly match the public API's 56-item catalogue. | Working; HTTP success alone does not prove every rendered route is correct. |
| Sitemap pagination | `/sitemap-1.xml` 404; root is a complete `urlset`, not an index. | Correct for this small catalogue; don't invent child URLs. |
| robots.txt | 200 `text/plain`, `User-agent: *`, `Allow: /`, correct apex sitemap declaration. | Working discovery. Submission to Google unverified. |
| Indexing headers | Public routes `X-Robots-Tag: index, follow`; `/account` and `/checkout` `noindex, nofollow`. | No earlier global noindex defect. Private protection retained. |
| Initial HTML | All 79 pages return the identical 1,759-byte shell; SHA-256 `82cb1a5db3fd217526af8a363f958c912fe29f2cf3be9ee95f34ec00b8735614`. Zero anchors, no Product JSON-LD/content, same homepage title/canonical/og:url. | JavaScript/API dependency and conflicting initial canonical. |
| Rendered product | `/products/14988`: unique title, product-name H1, product canonical, description, Product/Offer/BreadcrumbList; visible £45.99 matches GBP Offer. Other samples: 14965 £1200, 14968 £39.99, 14961 £15.99, 14984 £19.99. | Real product content available after rendering; sampled offers match visible/public catalogue data, not a physical inventory audit. |
| Link discovery | Homepage rendered DOM contains all 56 product and 15 category anchors, without interaction, so DOM crawl depth is 1. **These directory links are normally visually clipped**, not a usable visible catalogue. | Distinguish machine/assistive DOM discovery from ordinary customer discovery. |
| Storybook navigation | Category intro → product pages → next/previous pages and product detail → category use real anchors. `/categories/vehicles` features 13263; `?page=1` has 14977/14976/14968/14967; `?page=2` has different products. | Crawlable after JS; page 1 wrongly canonicalises to the intro. Paginated spreads have H2s but no H1. |
| Missing pages | `/products/999999999` HTTP 200, then unavailable + JS `noindex,follow`; invented top-level path HTTP 200 and homepage canonical/index directive. | Soft-404/duplicate fallback; not a broken sitemap link. |
| Compression | HTML, XML, JS and CSS gzip confirmed. JS 557,635 decompressed bytes; 194,855 encoded body bytes in browser sample. | Earlier no-gzip issue is fixed; don't repeat that remediation. |
| Tracking | No Google Analytics/Tag Manager network requests in observed browsing, no integration found in current source or served JS. Privacy/cookie pages explicitly state no analytics. | No confirmed ecommerce acquisition attribution. GSC/GA/MC account status cannot be inferred from code. |

The initial fast rendered crawl triggered catalogue API 429 responses and stopped at `/products/13262`; it was not a completed all-page rendering crawl. Representative pages subsequently rendered successfully at a slower pace. Infra source `ops/ec2/browser-sandbox/http-controls.conf:2` defines 2 requests/s with shared API burst limits; source configuration is consistent with, but does not independently prove the live cause. Do not loosen authentication/payment rate limits for SEO. Prefer cacheable public catalogue rendering and review only the public GET path with security owners if normal traffic proves affected. API error responses do not establish product absence.

## Performance and mobile evidence

| Single cold Chromium navigation | Desktop | Mobile |
|---|---:|---:|
| Viewport | 1440×900 | 390×844 |
| Profile | Unthrottled network/CPU | 1.6 Mbps down, 0.75 Mbps up, 150 ms latency, 4× CPU slowdown |
| HTTP transfer, including navigation | 2,719,431 bytes | 2,677,167 bytes |
| Observed LCP | 372 ms | 14,068 ms |
| Horizontal overflow | None | None |

These are single lab observations, not Lighthouse scores or field Core Web Vitals. Mobile layout-shift sum without input was 0; INP was not measured. Six randomly selected bookmark images make page weights vary. PageSpeed Insights API returned 429 quota exceeded; CrUX p75 and field CWV are **unverified**, not failed by inference.

The cover is 508,246 encoded bytes. Individual bookmark WebPs are roughly 155–289 KB despite small displayed dimensions; six load on mobile even when their tabs are not visible. Background adds 216,082 bytes; account/cart PNGs add 248,160 bytes. The homepage is below 3 MB in these samples, yet still slow on constrained mobile. Resize artwork to actual maximum CSS dimensions with appropriate 2× variants; avoid requesting mobile-hidden bookmark art; keep the visible cover eager. Then repeat three cold runs under the same profile and compare median LCP and bytes. Do not replace the visual identity or assume WebP alone solved performance.

Screenshots captured locally: `/tmp/build-bloom-desktop-live.png`, `/tmp/build-bloom-mobile-live.png`, `/tmp/build-bloom-seo-patch-desktop.png`, `/tmp/build-bloom-seo-patch-mobile.png`. Desktop/mobile product screenshots show the book layout and an internally scrollable detail panel; this is not a full accessibility or checkout test.

## Ecommerce and trust

- All 56 public product titles are unique; descriptions exist for all, ranging from 29 to 106 whitespace-delimited words. That is content presence, not proof of originality or manufacturer accuracy. Fifty titles omit “LEGO” although the page shows the set number and brand separately. Prefer natural `LEGO® [set number] [official set name] | Build & Bloom` titles without duplicating LEGO where already present.
- Current JSON-LD uses actual sellable-offer prices, GBP, InStock, canonical product URL, LEGO brand, set-number SKU, product images and sequential breadcrumbs. No fabricated reviews/ratings observed in code or samples. This patch adds the already-published set number as `mpn`; it does not invent EAN/GTINs.
- All current public API products report IN_STOCK. Out-of-stock behavior is therefore **source/test verified only**, not live demonstrated: URL stays indexable, non-sellable offers excluded, OutOfStock emitted without a fabricated price. A price-less Offer may not qualify for Google merchant results. Do not invent a price; retain legitimate product content and only emit a supported offer when authoritative pricing/condition exists.
- The existing condition policy deliberately omits `itemCondition` for `USED_LIKE_NEW`/outer-box-damage offers. `/products/14961` demonstrates this. Resolve the business definition before a Merchant Center feed; do not map damaged packaging blindly to used/new or advertise all stock as factory sealed. Physical condition and sellable inventory have not been independently verified.
- All products have images. Public image alt metadata is missing for three images of 14984; the rendered main image correctly falls back to its product title, while thumbnails are decorative with labelled buttons. This is a descriptive-data improvement, not an entirely missing accessible name. All images loaded in the slower rendered samples. UUID image filenames are not worth a disruptive rename; descriptive alt text, discoverable URLs, quality and performance matter more.
- Homepage JSON-LD has no Organization/OnlineStore identity. Public footer/contact provide Colorful Life Ltd, company no. 08097729, UK office/contact and non-affiliation statement. Add an accurate merchant entity based on owner-confirmed published facts, not invented opening hours, customer reviews, warehouse claims or local-shop status.
- Delivery page actually states £3.99 standard and £7.99 express; estimates are after dispatch, with separate normal dispatch timing. Preserve that distinction. Return terms, cancellation form, contact, privacy and terms are linked. Product detail pages sampled link back to category but provide no direct delivery/returns/contact anchors in their own detail view. Add concise policy links, not invented delivery promises.
- CookieNotice still mentions “PayPal Sandbox (only when requested)”; current release direction is Stripe-only. Coordinate that policy correction with the existing checkout/security work rather than editing payment behavior here.
- LEGO non-affiliation wording is present. Do not present Build & Bloom as an authorised LEGO retailer without evidence. LEGO's [Fair Play guidance](https://www.lego.com/en-us/legal/notices-and-policies/fair-play) covers non-commercial fan usage; it is not a commercial image/logo licence. Owner should retain supplier/image rights evidence. No legal clearance is claimed.

Google can process rendered structured data, but warns that dynamically generated Product markup can make shopping crawls less reliable ([Google guidance](https://developers.google.com/search/docs/appearance/structured-data/generate-structured-data-with-javascript)). A formal Rich Results Test and Search Console merchant report were not run/accessed; valid JSON parsing is not rich-result eligibility certification.

## GEO: useful facts, not special tricks

Rendered pages establish an independent UK LEGO seller, set numbers, prices, stock claims and policies. Raw HTML does not establish individual product facts. Ambiguous set condition, hidden homepage copy and lack of a stable merchant entity weaken machine understanding as well as shopper trust.

Use visible factual descriptions, manufacturer references for set facts, original condition photographs where appropriate, clear merchant identity and consistent shipping/return information. Optional Organization/OnlineStore structured data can disambiguate the merchant; it is not a ranking guarantee. Do not add invented `sameAs`, review markup, mass AI articles or `llms.txt` as a substitute for content. Google's [AI features guidance](https://developers.google.com/search/docs/appearance/ai-features) says no special AI markup/files are required and eligibility does not guarantee inclusion. Other AI systems' crawling/citation behavior has not been verified.

## Search demand and competitor observations

Search research establishes relevant query patterns and competitors, **not volumes, difficulty, current Google positions or forecast sales**. Search result snippets can be stale; competitor promises below are their published claims, not independently verified operations.

| Candidate intent | Existing catalogue evidence | Commercial angle and constraint |
|---|---|---|
| `LEGO 75222 Betrayal at Cloud City UK` | 14965, £1200, API stock 1, retired flag | Very specific collector intent; high trust burden. Confirm genuine complete set, seals/box condition and fulfilment before promoting. |
| `LEGO 76917 Nissan Skyline R34 UK` | 14968, £39.99, API stock 8, NEW | More inventory; strong direct competition from [Smyths' exact-set page](https://www.smythstoys.com/uk/en-gb/toys/lego-and-bricks/lego-speed-champions/lego-speed-champions-76917-2-fast-2-furious-nissan-skyline-gt-r-r34-car-set/p/215736). Search surfaced the page; direct fetch returned 403. No current price comparison claimed. |
| `LEGO 41329 Olivia's Deluxe Bedroom UK` | 14961, £15.99, stock 1, non-NEW condition, retired flag | Condition-specific niche; do not target “new sealed” unless verified. Search surfaced eBay UK and PriceSpy set pages. |
| `LEGO 40220 London Bus UK` | 14979, £15.99, stock 1, non-NEW condition | Specific gift/collector intent; search surfaces Wilko, marketplaces and price comparison. Don't call it an exclusive or retired set from assumption. |
| `LEGO Speed Champions cars UK` | 14 products currently grouped under Vehicles, mixed subthemes | Describe actual models/subthemes in the existing category; do not silently relabel every vehicle as Speed Champions. |

[BuyMyBricks](https://www.buymybricks.com/pages/buy-retired-lego-uk) uses a retired-set landing page, set-number search, theme links and visible condition/delivery/returns claims. [Brickabrac](https://brickabrac.co.uk/) surfaces searchable inventory, retired/outlet collections, prices and merchant reassurance without opening an illustrated book. These are useful patterns, not businesses whose claims/discounts should be copied. Broad “buy LEGO UK” is a poor first focus for a 56-product shop compared with exact sets, verified condition and real UK availability.

Public API flags 11 products retired; this is a starting list for owner/manufacturer validation, not independent proof. Two useful small content pieces: a factual comparison of stocked LEGO car sets (set number, pieces, dimensions from manufacturer, age guidance, current stock links), and an honest guide to box condition when buying older sets. Avoid generic daily posts or “rare” claims without evidence.

## Measurement and Merchant Center

**Search Console: UNVERIFIED.** No authorised connector/session or account evidence. A `site:` search is not indexing proof. Owner action: open the domain property, verify ownership if needed using Google's actual TXT token, submit `/sitemap.xml`, inspect root/category/product URLs, and export Coverage/Indexing, Google-selected canonical, rendered HTML and Performance by UK/query/page. Do not invent a token or resubmit all pages daily.

**Merchant Center/free listings: UNVERIFIED.** No account access, claimed-domain evidence, submitted feed or item diagnostics. No merchant feed implementation located in the inspected source. A sitemap is not a product feed. Begin with one maintained data source derived from approved sellable listings; stable listing IDs, exact landing URLs, title, brand, verified MPN/GTIN where available, real condition, GBP price, available stock, product image, shipping and returns. Mixed-condition offers need truthful landing-page/offer correspondence. Never export test inventory as launch inventory.

The served JS contains a TEST publishable-key marker, not a LIVE marker (keys were not printed). This does not independently identify effective Backend payment mode. Owner production launch approval and a genuinely purchasable live checkout remain prerequisites for commercial listing activation; this SEO work must not activate payments. Google's [free listings requirements](https://support.google.com/merchants/answer/13889434) require UK shipping data and accurate products; its [store requirements](https://support.google.com/merchants/answer/12160471) require a functioning secure purchase method. Free-listing opt-in is not proof that products are approved or shown.

**Acquisition/conversion attribution: not implemented/verified.** Start with Search Console and Merchant Center reports plus existing aggregate confirmed-order/refund reports, reviewed once weekly; they do not provide person-level attribution. If GA4 is chosen later, explicitly review consent and the current no-analytics policy. Measure view_item, add_to_cart, begin_checkout and purchase only at their real states; deduplicate purchase by order/transaction ID, keep TEST separate, record refunds accurately, never use button clicks as proof of paid orders, and never send PII. No tracking was added in this patch.

## Top ten improvements, ordered by expected business impact

Ordering is judgement, not a quantified traffic forecast. P1 = serious discovery/rendering issue, P2 = material ecommerce/measurement improvement, P3 = optional. No confirmed P0.

| Rank | Priority / exact evidence | Impact | Smallest safe change | Verify |
|---|---|---|---|---|
| 1 | P1: every sitemap HTML response, `index.html:16`; vehicles `?page=1`, `routeHead.ts` | Conflicting canonicals can consolidate distinct products/listing pages. | This PR removes shared-shell root canonical/og:url and gives page 1 its own canonical. | Raw shell has no wrong canonical; rendered routes have exactly one; GSC selected canonicals after approved deployment. |
| 2 | P1: 79 identical shells, zero raw anchors, no product content | JS/API/render-queue dependency for Google and non-JS AI crawlers. | Design bounded prerendering of public home/category/product/trust routes within existing Vite build, or server rendering if freshness requires it; no platform rewrite. Serve same content to users/bots; fail on unavailable data, exclude private routes, define price/stock freshness. | JS-disabled and raw HTML expose real links/text/head; compare to API and rendered pages; URL Inspection. Not implemented here. |
| 3 | P1: `/`, `HomepageDiscovery.css:10–12`, screenshot/H1 x=-1,width=1 | New customers cannot see what the shop sells or browse the full catalogue normally. | Integrate a visible short UK-store intro/H1 and clear catalogue/category entry into approved storybook design, with genuinely visible expandable directory if needed. Avoid resurrecting an unwanted duplicate page. | Desktop/mobile screenshot + keyboard path; content usable by ordinary shoppers, not only focus/assistive tech. |
| 4 | P1: homepage mobile lab LCP 14.1s, artwork assets above | Slow first impression hurts constrained-mobile discovery and sales. | Resize cover/bookmarks, avoid loading mobile-hidden art; preserve eager cover and visual quality. | Three same-profile cold runs, bytes/LCP comparison; field CWV when available. |
| 5 | P2: Search Console account/submission/indexing unknown | No feedback on whether Google sees the products or which queries convert. | Owner grants access/verifies property and submits existing sitemap. | Actual indexing/canonical/performance exports, not source assertions. |
| 6 | P2: Merchant Center/feed unverified; TEST bundle | Missing a measurable free-product acquisition channel. | Owner-approved live-readiness gate, then one accurate source/feed and shipping/returns setup. | Approved/eligible items, landing-page price/stock/condition agreement, listing clicks; no promised impressions. |
| 7 | P2: `structuredData.ts:12–34`, sample 14961; no merchant entity | Product matching and merchant trust incomplete. | MPN added here; verified GTINs only later; resolve condition policy; add accurate merchant/policy data. Keep honest out-of-stock behavior. | Rich Results Test + Merchant diagnostics; no invented rating/price/condition. |
| 8 | P2: 50/56 product titles omit brand; Vehicles/Marvel generic copy | Weak exact-set/themed shopping relevance and limited differentiation. | Improve 5–10 verified stock pages first: natural official name/number/brand, original condition/fulfilment facts, links to relevant category and policies. | Search Console UK query/page movement and qualified clicks; no mass keyword pages. |
| 9 | P2: no acquisition/conversion integration; explicit no-analytics policy | Traffic cannot yet be reliably tied to buying behavior. | Weekly GSC/MC + aggregate orders dashboard first; consent-reviewed GA4 only if needed. | Correct TEST exclusion, confirmed-payment purchase deduplication, refunds and no PII. |
| 10 | P2: `/products/999999999`/invented path HTTP 200; P3: missing OG image, no H1 on spreads, 14984 generic alt fallback | Wasted crawl/poor link previews and weaker content semantics. | Separate public not-found response handling coordinated with rendering; add page heading, factual image alt/OG image without changing identifiers or routing business flows. | Unknown URLs 404/410 where appropriate; existing/private routes retained; previews and accessibility checked. |

## Thirty-day plan: roughly three focused hours a week after initial technical work

- **Days 1–7:** Review this PR; owner separately approves merge/deployment. Capture actual GSC ownership/indexing baseline. Approve a visible homepage treatment and artwork task; scope minimal public prerendering with freshness safeguards. Select 5–10 physically verified, margin-positive sets. Record SKU, condition, units, delivered price and candidate query; do not market test stock. No additional full payment lifecycle test is requested.
- **Days 8–14:** Publish approved rendering/visibility/performance fixes through existing CI/CD and verify the real domain. Improve selected product facts and category copy. Configure Merchant Center draft/source and shipping/returns; activate free listings only after separate commercial launch gates pass. Run Rich Results/URL Inspection on representative pages.
- **Days 15–21:** Publish one useful comparison guide based on stocked products and manufacturer facts, with direct product/category links. Add accurate merchant identity/condition data. Make relevant community introductions only where promotion is allowed; no purchased links, fabricated reviews or mass outreach. Preserve independent-retailer positioning.
- **Days 22–30:** Review UK non-brand impressions/clicks by set and page, index coverage, Merchant item issues and clicks, confirmed orders/net revenue. Fix actual feed disapprovals and factual gaps; improve pages getting impressions but poor clicks. Publish a second useful guide only if stock and emerging query evidence support it.

Weekly scorecard: approved published SKU count; indexed canonical sample/pages (GSC); UK non-brand impressions/clicks/CTR by set; Merchant eligible/disapproved count and free-listing clicks; organic attribution if legitimately available; aggregate confirmed orders/net revenue; mobile lab trend. Establish baselines before numeric targets. Thirty days is sufficient to establish measurement and reduce friction, not to guarantee rankings, AI citations or sales. If LIVE remains unapproved, finish technical/content preparation and keep commercial activation deferred.

## Patch validation and review boundary

Seven source/test files changed: shared shell metadata, route canonical handling/tests, Product MPN/tests. This document and JSON add evidence only. No Backend/Infra/CI/payment files changed.

Local validation: 116 test files, **1,338 tests passed**, zero failures; lint, `tsc -b --noEmit`, contract checks, legal check and production build passed. Build retains the existing >500 KB JS chunk warning. Regression tests load the actual shared HTML shell, check canonical/og:url uniqueness, page-1/UTM handling, MPN and omission of invented GTINs/ratings. Existing sold-out/private/auth/payment tests remain in the full suite.

Local built preview at 1440×900 and 390×844: exactly one product canonical, MPN 76343, page-1 self canonical, no horizontal overflow. Only allowlisted public GET catalogue calls were forwarded during the preview; all other API methods/paths were blocked. No cart/payment action performed. Production build used default local origin for this verification; existing release workflow still sets VITE_SITE_URL to the apex HTTPS domain.

No merge/deployment approval implied. Review the focused patch alongside Claude's security work; larger rendering/design, condition/merchant and measurement decisions remain separate. Search Console/MC account evidence and field performance remain missing.
