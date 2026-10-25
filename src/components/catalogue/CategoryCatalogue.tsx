import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties } from 'react'
import { BookShell } from '../BookShell'
import { PageTurn } from './PageTurn'
import { OpeningWelcomePage } from './OpeningWelcomePage'
import { CatalogueIndexPage } from './CatalogueIndexPage'
import { FrontMatterContentsPage, FrontMatterWelcomePage } from './FrontMatterSpread'
import type { CatalogueCategory } from './categories'
import { resolveCatalogueCategories } from './categories'
import { CategoryOpeningPage } from './CategoryOpeningSpread'
import { CategoryLeaflet } from '../leaflet/CategoryLeaflet'
import { SearchLeaflet } from '../leaflet/SearchLeaflet'
import { useCatalogueSearch } from '../../features/catalogue/useCatalogueSearch'
import { useCategoryCatalogue } from '../../features/catalogue/useCategoryCatalogue'
import type { CatalogueCategoriesState } from '../../features/catalogue/useCatalogueCategories'
import './CategoryCatalogue.css'
import type { CatalogueLeafletSide, CatalogueSpread, DetailsLocation } from './catalogueSpread'
import { categoryLocation, categorySpreadIndex, isCategoryIndexSpread, isProductDetails, legalLocation, normalizeProductLocation, productDetailsLocation, sameSpread, spreadAfterAction } from './catalogueSpread'
import { CustomerInformationIndex, LegalDocument } from '../legal/CustomerInformation'
import { LEGAL_PAGES, type LegalSlug } from '../../features/legal/routes'
import { planProductSpreads } from '../../features/catalogue/productSpreads'
import { CatalogueProductDetails, VehiclesProductPage } from './VehiclesProductPage'
import type { CatalogueProduct, ProductListingOffer } from '../../features/catalogue/api'
import { useCatalogueProduct } from '../../features/catalogue/useCatalogueProduct'
import { useRouteHead } from '../../features/seo/documentHead'
import { catalogueRouteHead, siteOrigin } from '../../features/seo/routeHead'
import { productBreadcrumbJsonLd, productJsonLd } from '../../features/seo/structuredData'

export type { CatalogueSpread } from './catalogueSpread'
type SearchDetails = { kind: 'search-details'; productId: number }
type PresentedSpread = CatalogueSpread | SearchDetails
const isSearchDetails = (location: PresentedSpread): location is SearchDetails => typeof location !== 'string' && location.kind === 'search-details'
const sameLocation = (a: PresentedSpread, b: PresentedSpread) => isSearchDetails(a) || isSearchDetails(b) ? isSearchDetails(a) && isSearchDetails(b) && a.productId === b.productId : sameSpread(a, b)

type CatalogueProps = {
  spread: CatalogueSpread
  onSpreadChange: (spread: CatalogueSpread) => void
  onClose: () => void
  onAddToCart?: (listing: ProductListingOffer, productTitle: string) => void
  leafletSide?: CatalogueLeafletSide | null
  onLeafletSideChange?: (side: CatalogueLeafletSide | null, settled?: boolean) => void
  onSpreadNormalize?: (spread: CatalogueSpread) => void
  backendCategoriesState: CatalogueCategoriesState
  onRetryCategories: () => void
}

function CategoryEntry({ category, onCategory }: { category: CatalogueCategory; onCategory?: (slug: string) => void }) {
  return <li><a className="category-entry" href={category.href}
    onClick={onCategory ? event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onCategory(category.id) } } : undefined}
    style={{ '--category-colour': category.colour ?? '#dfdbc2', '--category-image-scale': category.imageScale ?? 1 } as CSSProperties}>
    <span className="category-entry__art">{category.image && <img src={category.image} alt="" width={category.imageWidth} height={category.imageHeight} decoding="async" />}</span>
    <span className="category-entry__copy"><span className="category-entry__label">{category.label}</span>
      {category.tagline && <span className="category-entry__tagline">{category.tagline}</span>}</span>
    <span className="category-entry__arrow" aria-hidden="true">↗</span>
  </a></li>
}

export function CataloguePageContent({ categories, heading, start, onCategory, emptyMessage }: {
  categories: readonly CatalogueCategory[]
  heading?: string
  start: number
  onCategory?: (slug: string) => void
  emptyMessage?: string
}) {
  return <nav className={`category-page${emptyMessage ? ' category-page--empty' : ''}`} aria-label={heading ?? 'Catalogue categories continued'}>
    {heading && <div className="category-page__heading"><h2>{heading}</h2><p>Build. Play. Collect. Bloom.</p></div>}
    {emptyMessage ? <p className="category-page__empty-message">{emptyMessage}</p> : <ol className="category-page__entries" start={start}>
      {categories.map(category => <CategoryEntry key={category.id} category={category} onCategory={onCategory} />)}
    </ol>}
  </nav>
}

export function CategoryCatalogue({ spread, onSpreadChange, onClose, onAddToCart, leafletSide: controlledLeafletSide, onLeafletSideChange, onSpreadNormalize, backendCategoriesState, onRetryCategories }: CatalogueProps) {
  const resolvedCategories = useMemo(() => backendCategoriesState.status === 'ready' ? resolveCatalogueCategories(backendCategoriesState.categories) : [], [backendCategoriesState])
  const categoryPages = useMemo(() => {
    const pages: CatalogueCategory[][] = []
    for (let index = 0; index < resolvedCategories.length; index += 3) pages.push(resolvedCategories.slice(index, index + 3))
    return pages
  }, [resolvedCategories])
  const categorySpreadCount = Math.ceil(categoryPages.length / 2)
  const [turn, setTurn] = useState<{ direction: 'forward' | 'backward'; from: PresentedSpread; to: PresentedSpread } | null>(null)
  const search = useCatalogueSearch()
  const [searchSession, setSearchSession] = useState<{ opener: HTMLElement | null; scrollTop: number; focusProductId?: number } | null>(null)
  const [searchVisible, setSearchVisible] = useState(false)
  const [searchDetails, setSearchDetails] = useState<SearchDetails | null>(null)
  const dataLocation = typeof spread !== 'string' ? spread : turn ? turn.to : spread
  const dataSpread = (isSearchDetails(dataLocation) ? spread : dataLocation) as CatalogueSpread
  // A stable product URL without in-book context reads the product to find its collection.
  const directProductId = isProductDetails(dataSpread) && !dataSpread.returnTo ? dataSpread.productId : undefined
  const { state: directProductState } = useCatalogueProduct(directProductId)
  const directProduct = directProductState.status === 'ready' ? directProductState.product : undefined
  const directCategory = directProduct?.category ? resolvedCategories.find(category => category.backendId === directProduct.category!.id) : undefined
  const origin = typeof dataSpread !== 'string' && dataSpread.kind !== 'legal' ? dataSpread.kind === 'details' ? dataSpread.returnTo ?? (directCategory && categoryLocation(directCategory.id, resolvedCategories)) : dataSpread : undefined
  const categoryOrigin = origin ? origin.kind === 'category' ? origin : categoryLocation(origin.slug, resolvedCategories) : undefined
  const categoryRecord = resolvedCategories.find(category => category.id === categoryOrigin?.slug)
  const { state: categoryState, retry: retryCategory } = useCategoryCatalogue(categoryRecord?.backendCategory, backendCategoriesState.status === 'ready')
  const products = categoryState.status === 'ready' ? categoryState.products : []
  const detailsProduct = (location: DetailsLocation | SearchDetails): CatalogueProduct | undefined => {
    if (location.kind === 'search-details') return search.state.status === 'results' ? search.state.data.items.find(item => item.id === location.productId) : undefined
    if (!('productId' in location)) return products.find(item => item.offers.some(offer => offer.id === location.listingId))
    return products.find(item => item.id === location.productId) ?? (directProduct?.id === location.productId ? directProduct : undefined)
  }
  const [internalLeafletSide, setInternalLeafletSide] = useState<CatalogueLeafletSide | null>(null)
  const leafletSide = controlledLeafletSide === undefined ? internalLeafletSide : controlledLeafletSide
  const setLeaflet = (side: CatalogueLeafletSide | null, settled = true) => {
    if (controlledLeafletSide === undefined) setInternalLeafletSide(side)
    onLeafletSideChange?.(side, settled)
  }
  const displayCategoryName = categoryState.status === 'ready' ? categoryState.category.name : categoryRecord?.label ?? 'Collection'
  const retryCategoryData = backendCategoriesState.status === 'error' ? onRetryCategories : retryCategory

  const productSpreads = planProductSpreads(products)
  const current: PresentedSpread = searchDetails ?? (typeof spread !== 'string' && spread.kind === 'products'
    ? { ...spread, index: Math.max(0, Math.min(spread.index, productSpreads.length - 1)) }
    : spread)
  useEffect(() => {
    if (typeof spread === 'string' || spread.kind !== 'products' || categoryState.status !== 'ready') return
    const normalized = normalizeProductLocation(spread, productSpreads.length, resolvedCategories)
    if (!sameSpread(normalized, spread)) (onSpreadNormalize ?? onSpreadChange)(normalized)
  }, [categoryState.status, onSpreadChange, onSpreadNormalize, productSpreads.length, resolvedCategories, spread])
  // Record in-book context for stable product URLs once known, or drop context that no longer contains the product.
  const repairedProduct = useRef<number | null>(null)
  useEffect(() => {
    if (!isProductDetails(spread)) return
    const normalize = onSpreadNormalize ?? onSpreadChange
    if (!spread.returnTo && directCategory) normalize(productDetailsLocation(spread.productId, categoryLocation(directCategory.id, resolvedCategories)))
    else if (spread.returnTo && categoryState.status === 'ready' && !categoryState.products.some(item => item.id === spread.productId) && repairedProduct.current !== spread.productId) {
      repairedProduct.current = spread.productId
      normalize(productDetailsLocation(spread.productId))
    }
  }, [categoryState, directCategory, onSpreadChange, onSpreadNormalize, resolvedCategories, spread])
  const urlDetails = typeof spread !== 'string' && spread.kind === 'details' ? spread : undefined
  const urlProduct = urlDetails ? detailsProduct(urlDetails) : undefined
  const urlProductMissing = Boolean(urlDetails && !urlProduct && (isProductDetails(urlDetails) ? directProductState.status === 'missing' : categoryState.status === 'ready'))
  const headOrigin = siteOrigin()
  useRouteHead(catalogueRouteHead({ spread, open: true, categories: resolvedCategories, categoriesReady: backendCategoriesState.status === 'ready', product: urlProduct, productMissing: urlProductMissing }),
    urlProduct && headOrigin ? [productJsonLd(urlProduct, headOrigin), productBreadcrumbJsonLd(urlProduct, resolvedCategories.find(category => category.backendId === urlProduct.category?.id), headOrigin)] : [])
  const locked = useRef(false)
  const unlockFrame = useRef<number | null>(null)
  useEffect(() => () => { if (unlockFrame.current !== null) cancelAnimationFrame(unlockFrame.current) }, [])

  const commitSpread = (next: PresentedSpread) => {
    if (isSearchDetails(next)) setSearchDetails(next)
    else if (searchDetails) setSearchDetails(null)
    else onSpreadChange(next)
  }
  const beginTurn = (direction: 'forward' | 'backward', next: PresentedSpread) => {
    if (locked.current || sameLocation(next, current)) return
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commitSpread(next)
      if (isSearchDetails(current)) setSearchVisible(true)
      return
    }
    locked.current = true
    setTurn({ direction, from: current, to: next })
  }
  const finishTurn = () => {
    if (!turn) return
    commitSpread(turn.to)
    unlockFrame.current = window.requestAnimationFrame(() => {
      setTurn(null)
      locked.current = false
      unlockFrame.current = null
      if (isSearchDetails(turn.from)) setSearchVisible(true)
    })
  }
  const emptyProductPage = (location: CatalogueSpread, side: 'left' | 'right') =>
    typeof location !== 'string' && location.kind === 'products' && categoryState.status === 'ready' && !productSpreads[location.index]?.[side].length

  /** Pages through the Customer Information chapter in its printed order. */
  const legalOrder = (slug: LegalSlug) => LEGAL_PAGES.findIndex(page => page.slug === slug)
  const openLegal = (slug: LegalSlug) => {
    const from = typeof current !== 'string' && !isSearchDetails(current) && current.kind === 'legal' ? legalOrder(current.page) : -1
    beginTurn(legalOrder(slug) < from ? 'backward' : 'forward', legalLocation(slug))
  }
  const openSearch = () => {
    if (locked.current || searchVisible) return
    search.reset()
    setSearchSession({ opener: document.activeElement as HTMLElement | null, scrollTop: 0 })
    setSearchVisible(true)
  }
  const pageContent = (location: PresentedSpread, side: 'left' | 'right') => {
    if (typeof location !== 'string') {
      if (!isSearchDetails(location) && location.kind === 'legal') return side === 'left'
        ? <CustomerInformationIndex current={location.page} onSelect={openLegal} turning={Boolean(turn)} />
        : <LegalDocument page={location.page} />
      if (isSearchDetails(location)) return <CatalogueProductDetails side={side} product={detailsProduct(location)} onAddToCart={onAddToCart} />
      if (location.kind === 'details') {
        const product = detailsProduct(location)
        const pending = !product && (categoryState.status === 'loading' || directProductState.status === 'loading')
        return <CatalogueProductDetails side={side} product={product} selectedOfferId={'listingId' in location ? location.listingId : undefined} onAddToCart={onAddToCart}
          unavailableMessage={pending ? 'Opening the collection…' : undefined} />
      }
      if (location.kind === 'category') return <CategoryOpeningPage side={side} state={categoryState} onRetry={retryCategoryData} onLeaflet={() => { if (!locked.current) setLeaflet('front') }} onDetails={productId => beginTurn('forward', productDetailsLocation(productId, location))} />
      return <VehiclesProductPage side={side} spread={productSpreads[location.index]} status={categoryState.status} categoryName={displayCategoryName} onRetry={retryCategoryData}
        onViewDetails={productId => beginTurn('forward', productDetailsLocation(productId, location))} />
    }
    if (location === 'opening') return side === 'left' ? <OpeningWelcomePage /> : <CatalogueIndexPage categories={resolvedCategories} />
    if (location === 'front-matter') return side === 'left' ? <FrontMatterWelcomePage /> : <FrontMatterContentsPage onCatalogue={() => beginTurn('forward', 'categories-primary')} onSearch={openSearch} onLegal={openLegal} turning={Boolean(turn)} />
    if (isCategoryIndexSpread(location)) {
      const spreadIndex = categorySpreadIndex(location)
      const pageIndex = spreadIndex * 2 + (side === 'right' ? 1 : 0)
      const page = categoryPages[pageIndex]
      if (page) return <CataloguePageContent categories={page} heading={side === 'left' ? (spreadIndex === 0 ? 'Our Catalogue' : 'More little worlds') : undefined}
        start={pageIndex * 3 + 1} onCategory={slug => beginTurn('forward', categoryLocation(slug, resolvedCategories))} />
      if (pageIndex === categoryPages.length && pageIndex % 2 === 1) return <CataloguePageContent categories={[]} start={pageIndex * 3 + 1} emptyMessage="More little worlds are coming..." />
      if (side === 'left' && backendCategoriesState.status === 'loading') return <p role="status">Finding little worlds…</p>
      if (side === 'left' && backendCategoriesState.status === 'error') return <div role="alert"><p>We couldn’t open the catalogue categories.</p><button type="button" onClick={onRetryCategories}>Try again</button></div>
      if (side === 'left' && backendCategoriesState.status === 'ready') return <p>No categories are available yet.</p>
      return null
    }
    return null
  }
  const pageClass = (location: PresentedSpread, side: 'left' | 'right') => {
    const category = typeof location !== 'string' && location.kind === 'category'
    const legal = typeof location !== 'string' && location.kind === 'legal'
    const product = typeof location !== 'string' && !category && !legal
    const next = isSearchDetails(location) ? location : spreadAfterAction(location, 'forward', productSpreads.length, categorySpreadCount, resolvedCategories)
    const navigation = side === 'left' || !sameLocation(location, next)
    return `spread-page${side === 'right' ? ' spread-page--right' : ''}${category ? ' spread-page--category-opening' : ''}${location === 'front-matter' ? ' spread-page--front-matter' : ''}${legal ? ` spread-page--legal spread-page--legal-${side}` : ''}${location === 'opening' && side === 'left' ? ' spread-page--welcome' : ''}${product ? ' spread-page--vehicles' : ''}${product && navigation ? ' spread-page--product-navigation' : ''}`
  }
  const pageNavigation = (location: PresentedSpread, side: 'left' | 'right') => {
    if (isSearchDetails(location)) return side === 'left' ? <div className="spread-page__navigation"><button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('backward', spread)}>← Back to Search Results</button></div> : null
    const categoryOpening = typeof location !== 'string' && location.kind === 'category'
    if (side === 'left') {
      if (location === 'opening') return null
      const backToCategory = typeof location !== 'string' && (location.kind === 'details' || location.kind === 'products' && location.index === 0)
      const legal = typeof location !== 'string' && location.kind === 'legal'
      const label = legal ? '← Back to Contents' : backToCategory ? `← Back to ${displayCategoryName}` : categoryOpening ? '← Back to Categories' : location === 'categories-primary' ? '← Back to Contents' : '← Back'
      return <div className="spread-page__navigation">{location === 'front-matter'
        ? <button type="button" disabled={Boolean(turn)} onClick={onClose}>← Close Book</button>
        : <button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('backward', spreadAfterAction(location, 'backward', productSpreads.length, categorySpreadCount, resolvedCategories))}>{label}</button>}</div>
    }
    const forward = spreadAfterAction(location, 'forward', productSpreads.length, categorySpreadCount, resolvedCategories)
    if (location === 'front-matter' || sameLocation(location, forward)) return null
    return <div className="spread-page__navigation"><button type="button" disabled={Boolean(turn)} onClick={() => beginTurn('forward', forward)}>
      {categoryOpening ? 'Continue in the storybook →' : typeof location !== 'string' ? `More ${displayCategoryName} →` : location === 'opening' ? (backendCategoriesState.status === 'ready' ? `Discover all ${resolvedCategories.length} worlds →` : 'Discover the catalogue →') : 'More →'}
    </button></div>
  }
  const frozenPage = (location: PresentedSpread, side: 'left' | 'right') =>
    !isSearchDetails(location) && emptyProductPage(location, side) ? null : <div className={pageClass(location, side)}>{pageContent(location, side)}{pageNavigation(location, side)}</div>
  const source = turn?.from ?? current
  const left = turn?.direction === 'backward' ? turn.to : source
  const right = turn?.direction === 'forward' ? turn.to : source

  return <>
    {typeof current !== 'string' && current.kind === 'products' && <span className="catalogue-spread-status" role="status">
      {displayCategoryName} product spread {current.index + 1} of {Math.max(1, productSpreads.length)}
    </span>}
    <BookShell
      leftPage={!isSearchDetails(left) && emptyProductPage(left, 'left') ? null : <div className={pageClass(left, 'left')} data-product-index={typeof current !== 'string' && current.kind === 'products' ? current.index : undefined}>{pageContent(left, 'left')}{pageNavigation(current, 'left')}</div>}
      rightPage={!isSearchDetails(right) && emptyProductPage(right, 'right') ? null : <div className={pageClass(right, 'right')}>{pageContent(right, 'right')}{pageNavigation(current, 'right')}</div>}
      pageTurn={turn ? <PageTurn direction={turn.direction} onComplete={finishTurn}
        front={frozenPage(turn.from, turn.direction === 'forward' ? 'right' : 'left')}
        back={frozenPage(turn.to, turn.direction === 'forward' ? 'left' : 'right')} /> : null}
    />
    {leafletSide && categoryOrigin && categoryState.status === 'ready' && createPortal(<CategoryLeaflet category={categoryState.category} products={categoryState.products} side={leafletSide}
      onSideChange={setLeaflet} onClose={() => setLeaflet(null)} onDetails={productId => { setLeaflet(null); beginTurn('forward', productDetailsLocation(productId, categoryOrigin)) }} />, document.body)}
    {searchVisible && searchSession && createPortal(<SearchLeaflet search={search} session={searchSession}
      onClose={() => { setSearchVisible(false); setSearchSession(null); search.reset() }}
      onDetails={(productId, scrollTop) => { setSearchSession({ ...searchSession, scrollTop, focusProductId: productId }); setSearchVisible(false); beginTurn('forward', { kind: 'search-details', productId }) }} />, document.body)}
  </>
}