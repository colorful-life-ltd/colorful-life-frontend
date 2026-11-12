# Build-time SEO prerendering

`npm run build` writes static HTML for every public, indexable route into
`dist/prerendered/`, after the normal Vite build:

- `prerendered/index.html` (home), `prerendered/help/index.html`, `prerendered/legal/<page>/index.html`,
  `prerendered/categories/<slug>/index.html` and `prerendered/products/<id>/index.html`
- `prerendered/sitemap.xml`, listing exactly those routes
- `prerendered/404.html`, a non-indexable page that does not start the app

Each page has its own title, description, robots, canonical, `og:url` and visible main
content in the initial HTML. Product pages carry the same Product and BreadcrumbList
JSON-LD the app emits (`src/features/seo/structuredData.ts`): prices only for sellable
offers, `OutOfStock` with no price otherwise, and no ratings or reviews. Head values come
from the app's own `catalogueRouteHead`, so static and client heads agree; the client
updates the static tags in place (`applyRouteHead`). `createRoot` in `src/main.tsx`
replaces the static `#root` content on mount; nothing is hydrated.

Private routes (checkout, account, orders, email verification, password reset) are never
prerendered. `dist/index.html` stays the unchanged app shell.

## Catalogue snapshot

Pages and sitemap come from one committed snapshot,
`src/prerender/catalogue-snapshot.json`: public categories, published products and the
live sitemap captured at the same time. The build fails if the prerendered routes differ
from that captured sitemap. Refresh it, review the diff, and commit:

```sh
node scripts/catalogue-snapshot.mjs https://build-and-bloom.co.uk
```

A product published after the snapshot is not prerendered until the snapshot is refreshed
and the storefront redeployed.

## Serving (requires a reviewed nginx change)

With the current vhost (`try_files $uri $uri/ /index.html`), nothing in
`dist/prerendered/` is served and live behaviour is unchanged. Directory pages must not be
placed at the dist root: that vhost would answer `/products/1` with a 301 to `/products/1/`.

To serve the pages and return real 404s, the storefront vhost needs (separate Infra review):

```nginx
location = /sitemap.xml { allow all; limit_except GET { deny all; } try_files /prerendered/sitemap.xml =404; ... }
location ~ "^/(products/[1-9][0-9]{0,9}|categories/[a-z0-9][a-z0-9-]{0,80})/?$" {
    allow all;
    try_files /prerendered$uri/index.html =404;
    error_page 404 /index.html;   # the app still loads for people; crawlers get 404 until the next build
    ...
}
location ^~ /prerendered/ { internal; ... }
location / { allow all; try_files $uri /prerendered$uri/index.html =404; ... }
error_page 404 /prerendered/404.html;
```
