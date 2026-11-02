import coverArtwork from '../../assets/categories/cover/build-bloom-cover.webp'
import bookmarkCity from '../../assets/categories/bookmarks/bookmark-city.webp'
import bookmarkCreator from '../../assets/categories/bookmarks/bookmark-creator.webp'
import bookmarkDisney from '../../assets/categories/bookmarks/bookmark-disney.webp'
import bookmarkFriends from '../../assets/categories/bookmarks/bookmark-friends.webp'
import bookmarkHeros from '../../assets/categories/bookmarks/bookmark-heros.webp'
import bookmarkMagic from '../../assets/categories/bookmarks/bookmark-magic.webp'
import bookmarkMarvel from '../../assets/categories/bookmarks/bookmark-marvel.webp'
import bookmarkNinjago from '../../assets/categories/bookmarks/bookmark-ninjago.webp'
import bookmarkVehicles from '../../assets/categories/bookmarks/bookmark-vehicles.webp'
import { CatalogueBookmark, type CatalogueBookmarkDefinition } from './CatalogueBookmark'
import { categoryPresentationById } from './categories'
import './ClosedCatalogue.css'
import { useState } from 'react'

type ClosedCatalogueProps = {
  onOpen: () => void
  onBookmark?: (href: string) => void
  showCityBookmark?: boolean
}

const bookmarkDefinitions: CatalogueBookmarkDefinition[] = [
  ['harry-potter', bookmarkMagic, 2070, 497],
  ['city', bookmarkCity, 1746, 435],
  ['disney', bookmarkDisney, 1786, 427],
  ['marvel', bookmarkMarvel, 2039, 485],
  ['dc-batman', bookmarkHeros, 2143, 510],
  ['friends', bookmarkFriends, 2139, 504],
  ['ninjago', bookmarkNinjago, 2121, 504],
  ['vehicles', bookmarkVehicles, 2132, 516],
  ['creator', bookmarkCreator, 2140, 519],
].map(([id, asset, width, height], index) => {
  const category = categoryPresentationById(String(id))!
  const bookmarkLabel = id === 'harry-potter' ? 'Magic' : id === 'dc-batman' ? 'Heroes' : category.label
  const extraReveal = bookmarkLabel.length > 6 ? (bookmarkLabel === 'NINJAGO' ? 12 : 8) : 0
  return { id, label: bookmarkLabel, href: '/categories/' + category.id, asset, width, height, top: `${4 + index * 16}%`, extraReveal } as CatalogueBookmarkDefinition
})

function selectDecorativeBookmarks() {
  return [...bookmarkDefinitions]
    .sort(() => Math.random() - 0.5)
    .slice(0, 6)
}

export function ClosedCatalogue({ onOpen, onBookmark, showCityBookmark = true }: ClosedCatalogueProps) {
  const activateBookmark = onBookmark
  const [visibleBookmarks] = useState(selectDecorativeBookmarks)
  return (
    <div className="closed-catalogue">
      <button className="closed-catalogue__trigger" type="button" onClick={onOpen} aria-label="Open Build & Bloom catalogue">
        <span className="closed-catalogue__back-cover" aria-hidden="true" />
        <span className="closed-catalogue__pages" aria-hidden="true" />
        <span className="closed-catalogue__cover">
          <img className="closed-catalogue__artwork" src={coverArtwork} alt="Build & Bloom catalogue cover artwork" />
        </span>
        <span className="closed-catalogue__spine" aria-hidden="true" />
      </button>
      {showCityBookmark && (
        <span className="closed-catalogue__bookmark-layer" aria-hidden="false">
          {visibleBookmarks.map((definition, index) => (
            <CatalogueBookmark key={definition.id} definition={{ ...definition, top: `${4 + index * 16}%` }} onActivate={activateBookmark} />
          ))}
        </span>
      )}
    </div>
  )
}
