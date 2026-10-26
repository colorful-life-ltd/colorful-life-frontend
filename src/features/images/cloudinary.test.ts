import { describe, expect, it } from 'vitest'
import { CLOUDINARY_VARIANTS, cloudinaryVariantUrl } from './cloudinary'

const upload = 'https://res.cloudinary.com/demo-cloud/image/upload/v1792485702/colorful-life/catalogue-artwork/14988-8da538cd.png'

describe('Cloudinary delivery variants', () => {
  it('inserts one shared auto-format, non-enlarging width transformation before the version', () => {
    expect(cloudinaryVariantUrl(upload, 'display')).toBe('https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto,c_limit,w_800/v1792485702/colorful-life/catalogue-artwork/14988-8da538cd.png')
    expect(cloudinaryVariantUrl(upload, 'thumbnail')).toBe('https://res.cloudinary.com/demo-cloud/image/upload/f_auto,q_auto,c_limit,w_160/v1792485702/colorful-life/catalogue-artwork/14988-8da538cd.png')
    expect(cloudinaryVariantUrl(`  ${upload} `, 'display')).toMatch(/\/f_auto,q_auto,c_limit,w_800\/v1792485702\//)
  })

  it('keeps the variant set small: exactly two sizes', () => {
    expect(Object.values(CLOUDINARY_VARIANTS)).toEqual(['f_auto,q_auto,c_limit,w_800', 'f_auto,q_auto,c_limit,w_160'])
  })

  it.each([
    ['local or bundled assets', '/assets/category-city.png'],
    ['other hosts', 'https://images.example.com/image/upload/v1/a.png'],
    ['plain http', upload.replace('https:', 'http:')],
    ['already transformed URLs', 'https://res.cloudinary.com/demo-cloud/image/upload/w_400/v1792485702/a.png'],
    ['signed URLs', 'https://res.cloudinary.com/demo-cloud/image/upload/s--AbCd1234--/v1792485702/a.png'],
    ['unversioned public ids', 'https://res.cloudinary.com/demo-cloud/image/upload/colorful-life/a.png'],
    ['fetch delivery', 'https://res.cloudinary.com/demo-cloud/image/fetch/v1/https://example.com/a.png'],
    ['video or raw resources', 'https://res.cloudinary.com/demo-cloud/video/upload/v1/a.mp4'],
    ['query strings', `${upload}?_a=BAMAK`],
    ['fragments', `${upload}#x`],
    ['empty values', ''],
    ['missing values', null],
  ])('leaves %s unchanged (returns null)', (_label, url) => {
    expect(cloudinaryVariantUrl(url, 'display')).toBeNull()
  })
})
