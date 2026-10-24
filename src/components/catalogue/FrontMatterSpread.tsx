import flower from '../../assets/decorations/catalogue-title-flower.png'
import leaf from '../../assets/shared/hr-leaf.png'
import './FrontMatterSpread.css'
import { legalHref, type LegalSlug } from '../../features/legal/routes'

/** Front matter belongs to the same physical page slots as the category spreads. */
export function FrontMatterWelcomePage() {
  return <article className="front-matter front-matter--welcome" aria-labelledby="front-matter-welcome-title">
    <header className="front-matter__welcome-heading">
      <img className="front-matter__flower" src={flower} alt="" aria-hidden="true" />
      <h1 id="front-matter-welcome-title"><span>Welcome to </span>Build &amp; Bloom</h1>
    </header>
    <div className="front-matter__story">
      <p>Every great build begins with a little imagination.</p>
      <p>Here at Build &amp; Bloom, we believe the joy is not only in what you build, but in the stories, adventures and memories you create along the way.</p>
      <p>So take your time, turn the pages, and see what catches your eye.</p>
    </div>
    <p className="front-matter__closing">There’s always something wonderful waiting to be built.</p>
  </article>
}

/** Customer Information pages open as spreads of this book (see features/legal/routes.ts). */
const informationSections: ReadonlyArray<readonly [string, string, LegalSlug]> = [
  ['Delivery & Returns', 'Everything about getting your order home', 'delivery-returns'],
  ['Contact Us', 'Come and say hello', 'contact'],
  ['Customer Information', 'Terms, privacy, cookies and cancelling an order', 'terms'],
]
const futureSections = [
  ['Help & FAQs', 'A little help when you need it'],
] as const

export function FrontMatterContentsPage({ onCatalogue, onSearch, onLegal, turning = false }: { onCatalogue: () => void; onSearch: () => void; onLegal?: (slug: LegalSlug) => void; turning?: boolean }) {
  return <nav className="front-matter front-matter--contents" aria-labelledby="front-matter-contents-title">
    <header className="front-matter__contents-heading">
      <h2 id="front-matter-contents-title">Contents</h2>
      <img src={leaf} alt="" aria-hidden="true" />
    </header>
    <ol className="front-matter__entries">
      <li><button className="front-matter__entry" type="button" onClick={onCatalogue} disabled={turning}>
        <span className="front-matter__entry-title">Our Catalogue <span className="front-matter__arrow" aria-hidden="true">→</span></span>
        <span className="front-matter__entry-description">Explore the Build &amp; Bloom collections</span>
      </button></li>
      <li><button className="front-matter__entry" type="button" onClick={onSearch} disabled={turning} data-find-a-set>
        <span className="front-matter__entry-title">Find a Set <svg className="front-matter__search-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 5 5" /></svg></span>
        <span className="front-matter__entry-description">Search by name or set number</span>
      </button></li>
      {informationSections.map(([title, description, slug]) => <li key={title}>
        <a className="front-matter__entry" href={legalHref(slug)} aria-disabled={turning || undefined} tabIndex={turning ? -1 : undefined}
          onClick={event => {
            // Plain clicks turn the page; modified clicks open the page's own URL.
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
            if (turning || onLegal) event.preventDefault()
            if (!turning) onLegal?.(slug)
          }}>
          <span className="front-matter__entry-title">{title} <span className="front-matter__arrow" aria-hidden="true">→</span></span>
          <span className="front-matter__entry-description">{description}</span>
        </a>
      </li>)}
      {futureSections.map(([title, description]) => <li key={title}>
        <button className="front-matter__entry" type="button" disabled aria-describedby="front-matter-future-note">
          <span className="front-matter__entry-title">{title}</span>
          <span className="front-matter__entry-description">{description}</span>
        </button>
      </li>)}
    </ol>
    <span id="front-matter-future-note" className="catalogue-spread-status">This section is not available yet.</span>
  </nav>
}
