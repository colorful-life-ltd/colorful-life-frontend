import type { BackendCategory } from '../../features/catalogue/api'
import harryPotter from '../../assets/categories/optimised/category-harry-potter.png'
import harryPotterWebp from '../../assets/categories/optimised/category-harry-potter.webp'
import starWars from '../../assets/categories/optimised/category-star-wars.png'
import starWarsWebp from '../../assets/categories/optimised/category-star-wars.webp'
import friends from '../../assets/categories/optimised/category-friends.png'
import friendsWebp from '../../assets/categories/optimised/category-friends.webp'
import city from '../../assets/categories/optimised/category-city.png'
import cityWebp from '../../assets/categories/optimised/category-city.webp'
import disney from '../../assets/categories/optimised/category-disney.png'
import disneyWebp from '../../assets/categories/optimised/category-disney.webp'
import marvel from '../../assets/categories/optimised/category-marvel.png'
import marvelWebp from '../../assets/categories/optimised/category-marvel.webp'
import jurassicWorld from '../../assets/categories/optimised/category-jurassic-world.png'
import jurassicWorldWebp from '../../assets/categories/optimised/category-jurassic-world.webp'
import flowers from '../../assets/categories/optimised/category-flowers-botanicals.png'
import flowersWebp from '../../assets/categories/optimised/category-flowers-botanicals.webp'
import ninjago from '../../assets/categories/optimised/category-ninjago.png'
import ninjagoWebp from '../../assets/categories/optimised/category-ninjago.webp'
import dcBatman from '../../assets/categories/optimised/category-dc-batman.png'
import dcBatmanWebp from '../../assets/categories/optimised/category-dc-batman.webp'
import vehicles from '../../assets/categories/optimised/category-vehicles.png'
import vehiclesWebp from '../../assets/categories/optimised/category-vehicles.webp'
import creator from '../../assets/categories/optimised/category-creator.png'
import creatorWebp from '../../assets/categories/optimised/category-creator.webp'
import others from '../../assets/categories/optimised/category-others.png'
import othersWebp from '../../assets/categories/optimised/category-others.webp'

/** Width of the files in assets/categories/optimised (scripts/optimise-category-artwork.mjs). */
export const OPTIMISED_CATEGORY_ARTWORK_WIDTH = 720

export type CategoryPresentation = {
  id: string
  label: string
  image?: string
  /** Optimised 720px WebP of `image` (a 720px PNG fallback); originals live in artwork/categories. */
  imageWebp?: string
  tagline?: string
  colour?: string
  imageWidth?: number
  imageHeight?: number
  imageScale?: number
  featured?: boolean
}

/** Curated styling is optional; backend categories remain the source of category existence. */
export const categoryPresentation: readonly CategoryPresentation[] = [
  { id: 'harry-potter', label: 'Harry Potter', image: harryPotter, imageWebp: harryPotterWebp, tagline: 'Magic in every build', colour: '#ead4c3', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'star-wars', label: 'Star Wars', image: starWars, imageWebp: starWarsWebp, tagline: 'Adventure among the stars', colour: '#cbdde8', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'friends', label: 'Friends', image: friends, imageWebp: friendsWebp, tagline: 'Build brighter days together', colour: '#f3cdd8', imageWidth: 1536, imageHeight: 1024 },
  { id: 'city', label: 'City', image: city, imageWebp: cityWebp, tagline: 'Every street tells a story', colour: '#d1e2df', imageWidth: 1536, imageHeight: 1024, imageScale: 1.08 },
  { id: 'disney', label: 'Disney', image: disney, imageWebp: disneyWebp, tagline: 'Build a little wonder', colour: '#dfd5ed', imageWidth: 1536, imageHeight: 1024 },
  { id: 'marvel', label: 'Marvel', image: marvel, imageWebp: marvelWebp, tagline: 'Heroes assemble here', colour: '#f1cbb8', imageWidth: 1536, imageHeight: 1024 },
  { id: 'jurassic-world', label: 'Jurassic World', image: jurassicWorld, imageWebp: jurassicWorldWebp, tagline: 'Big adventures from another age', colour: '#d5dfbc', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'flowers-botanicals', label: 'Flowers & Botanicals', image: flowers, imageWebp: flowersWebp, tagline: 'Build something beautiful', colour: '#e4e6b8', imageWidth: 1536, imageHeight: 1024, imageScale: 1.1 },
  { id: 'ninjago', label: 'NINJAGO', image: ninjago, imageWebp: ninjagoWebp, tagline: 'Train. Build. Adventure.', colour: '#c9e0d5', imageWidth: 1536, imageHeight: 1024, imageScale: 1.1 },
  { id: 'dc-batman', label: 'DC & Batman', image: dcBatman, imageWebp: dcBatmanWebp, tagline: 'Heroes after dark', colour: '#d9d5e7', imageWidth: 1374, imageHeight: 1145 },
  { id: 'vehicles', label: 'Vehicles', image: vehicles, imageWebp: vehiclesWebp, tagline: 'Built for the thrill', colour: '#f3c9bc', imageWidth: 1536, imageHeight: 1024, featured: true },
  { id: 'creator', label: 'Creator', image: creator, imageWebp: creatorWebp, tagline: 'Imagine it. Build it differently.', colour: '#f3dfa9', imageWidth: 1536, imageHeight: 1024 },
  { id: 'others', label: 'Others', image: others, imageWebp: othersWebp, tagline: 'More little worlds to discover', colour: '#dfdbc2', imageWidth: 1536, imageHeight: 1024 },
]

export type CatalogueCategory = CategoryPresentation & {
  /** Runtime route key: a preserved curated slug or a deterministic name slug. */
  id: string
  backendId: number
  backendCategory: BackendCategory
  href: string
  image?: string
}

const normalizeName = (name: string) => name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim()
const slugFromName = (name: string, backendId: number) => {
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || `category-${backendId}`
}

/** Resolve category existence from the API, applying presentation only when a curated match exists. */
export function resolveCatalogueCategories(categories: readonly BackendCategory[]): CatalogueCategory[] {
  const configs = new Map(categoryPresentation.map((item, index) => [normalizeName(item.label), { item, index }]))
  const candidates = categories.map(category => {
    const configured = configs.get(normalizeName(category.name))
    return { category, presentation: configured?.item, order: configured?.index ?? Number.MAX_SAFE_INTEGER,
      sortName: normalizeName(category.name), baseSlug: configured?.item.id ?? slugFromName(category.name, category.id) }
  }).sort((a, b) => a.order - b.order || a.sortName.localeCompare(b.sortName, 'en') || a.category.id - b.category.id)
  const usedSlugs = new Set<string>()
  return candidates.map(({ category, presentation, baseSlug }) => {
    let slug = baseSlug
    if (usedSlugs.has(slug)) slug = `${baseSlug}-${category.id}`
    while (usedSlugs.has(slug)) slug = `${slug}-${category.id}`
    usedSlugs.add(slug)
    const managedThumbnail = category.thumbnailUrl?.trim() || undefined
    const image = managedThumbnail ?? presentation?.image ?? category.imageUrl ?? undefined
    return {
      backendCategory: category,
      ...(presentation ?? { id: slug, label: category.name }),
      id: slug,
      backendId: category.id,
      label: presentation?.label ?? category.name,
      image,
      href: `/categories/${slug}`,
    }
  })
}
export function categoryPresentationById(id: string) {
  return categoryPresentation.find(category => category.id === id)
}
