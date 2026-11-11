# Production storefront candidate — 11 November 2026

Status: preparation only. Do not merge this documentation PR or deploy/switch routes without owner approval. No Production artifact or rollback artifact has yet been authenticated. This document does not authorize a build, promotion, route change or activation.

## Pinned source and existing release mechanism

The reviewed frontend main source is `4518d9ab545ee35a2ab79531dcc80de146b63ab4` (merge of #115). Its [main CI run](https://github.com/colorful-life-ltd/colorful-life-frontend/actions/runs/42718726821) passed verification and deployed the **Sandbox** build. The source SHA is not an artifact checksum. This document-only PR does not change the selected application source.

The supported Production path is the separately owned Infra [Production storefront release runbook](https://github.com/colorful-life-ltd/colorful-life-infra/blob/195b44835c42c6c3022445ab24d5088eb4bc03c2/docs/production-storefront-release.md), at Infra main `195b44835c42c6c3022445ab24d5088eb4bc03c2`. Its manual `production-storefront-build.yml` builds, scans, packages and separately attests; it does not deploy. The existing frontend `storefront.yml` deploys Sandbox and must not be repurposed for Production. Infra #76 proposes retained asset improvements and is not yet merged; assess its final state before cutover.

The existing Production builder requires the owner to provision the intended **public** LIVE publishable key as `PRODUCTION_STRIPE_PUBLISHABLE_KEY` in the protected `image-publication` environment and independently approve its SHA-256 fingerprint. It also requires a dedicated read-only source App, enabled build gate, and a protected attestation environment with working private artifact attestations. Never put a Stripe secret, restricted key or webhook secret in frontend configuration. A public key configures Stripe.js; it is not a payment-initiation switch. Do not use a synthetic key as a release key. Obtain the exact signed archive digest and attestation from a successful authorized workflow; until then both are unavailable.

The owner confirmed the key and fingerprint are not yet approved. In the **Infra repository** GitHub environment `image-publication`, the owner must configure the public key as the environment secret named above, after confirming that environment's protection and required reviewers. The owner can calculate its SHA-256 locally over the exact UTF-8 key bytes with no trailing newline, without printing the key or placing it in shell history:

```bash
read -r -s -p 'Stripe Live publishable key: ' bloom_public_key
printf '\n'
printf %s "$bloom_public_key" | sha256sum
unset bloom_public_key
```

Independently approve the resulting 64-hex digest and use it as `key_fingerprint` with the pinned `frontend_sha` when running the manual Infra build after its other gates are met. Confirm the key is the intended account's `pk_live_` publishable key; never enter a secret key. The workflow compares the supplied fingerprint against the protected key, and the build/attestation cannot complete without it. Do not set the build gate or dispatch the workflow as part of this preparation.

The builder sets `VITE_TARGET_ENVIRONMENT=production`, `VITE_API_ENVIRONMENT=production`, `VITE_API_BASE_URL=/api`, `VITE_SITE_URL=https://build-and-bloom.co.uk` and `VITE_PAYMENT_MODE=stripe-live`, with the pinned source revision and owner key. Its allowlisted environment omits `VITE_REGISTRATION_ENABLED`, so the frontend registration/sign-in overlay remains closed. Independently verify Backend registration and Stripe initiation gates are off; the build does not enforce those server gates, and checkout code can request initiation if the Backend permits it. Do not submit orders, initiate payments, or enable gates for acceptance.

## Route coordination and mixed-environment transition

Infra [#73](https://github.com/colorful-life-ltd/colorful-life-infra/pull/73) records an approved 9 November host change: catalogue GETs and sitemap use Production `127.0.0.1:3002`, while customer routes still target Sandbox `127.0.0.1:3001`. The public frontend is a Sandbox build. This is historical evidence, not a fresh effective-config inspection. The current public manifest independently identifies a Sandbox build. Do not infer Production inventory or route identity from a hostname or the frontend's `/api` setting.

Before cutover, coordinate with Backend/Infra owners to freeze their exact reviewed nginx change and running Production API image/revision. The Production verifier requires the dedicated Production static root, exact customer API allowlist and methods, default deny, numeric route patterns, Production `3002` and `proxy_next_upstream off`; `/sitemap.xml` also targets `3002`. Preserve webhook verification and protected operator routes. Inspect effective config and actual worker state using the Infra runbook, independently prove the `3002` process identity and readiness, and verify all allowed routes and sitemap consistently target Production, with no `3001` fallback. Test against distinct labelled stubs before a live change.

Plan a coordinated maintenance window: block customer traffic at the reviewed edge/maintenance gate while the root and all customer/API/sitemap routes are switched and verified as a single release operation. A graceful nginx reload alone can leave old workers serving existing connections; drain old workers/connections and caches, then confirm effective workers and external responses before reopening. If a safe gate/drain cannot be demonstrated, do not switch. Do not send writes or real customer credentials to either environment during verification. Record config hashes and the rollback decision before starting; routing changes are separately owned and approved.

## Artifact and rollback gates

1. Have the owner configure and approve the key fingerprint and CI prerequisites. Dispatch the existing build only when its owner gates are satisfied, pinning the source above and the approved fingerprint. Retain successful run URL, exact Infra signer SHA, frontend SHA, archive SHA-256, signed attestation, key fingerprint and complete file manifest. Independently verify attestation and full archive integrity according to the Infra runbook. Validate registration is closed and no test/private key is present in the actual artifact.
2. Establish an independently reviewed, signed Production-compatible previous artifact, prove its availability/integrity and compatibility with the exact running Backend and current schema, and rehearse the Production rollback path. The live Sandbox archive is not a Production rollback. A second copy of an unproven candidate is not a known-good rollback. If no prior Production release exists, the Infra tool's first activation can restore an empty pointer only; that is not a verified rollback or a healthy storefront. Stop unless the owner explicitly accepts the resulting availability risk and a separate safe recovery plan.
3. Review Infra #76's final asset-retention status. Retain previous hashed assets for open tabs; do not delete shared assets. Use a fresh owner approval for the exact artifact and action. The Infra promoter validates the Production route and backend identity; it does not install nginx or change payment flags.
4. On a failed cutover, keep the customer gate closed. Restore the independently verified compatible Production artifact through the documented rollback/recovery procedure, restore the reviewed matching Production routing if required, verify worker drain, content and API identity, then reopen only after acceptance. Never fall back to port 3001, the Sandbox release, an obsolete holding-page script, database reversal or financial retries. If restoration cannot be proven, remain closed and escalate.

## Smoke checks after separately approved activation

- Check release manifest/source, actual archive and attestation, HTTPS/host redirects, static assets, effective route digest and Production API/worker identity. Confirm customer route set and sitemap have no Sandbox upstream or fallback.
- Confirm customer registration and payment initiation remain disabled at their independent authoritative Backend gates; verify the closed UI without sending a signup, order or payment request. Inspect operational evidence without exposing credentials.
- Compare Production catalogue to the owner's approved inventory: categories, all 56 intended products, prices, images, product detail links and Sold Out behavior. Do not assume the quantity-one update has happened. Test cart/checkout with fixtures before release; live writes require separate authorization.
- On desktop and mobile, exercise navigation, categories, product details, image loading, basket states and accessibility/keyboard navigation; check browser console/network and horizontal overflow. Do not make a real order.
- Check `robots.txt`, `/sitemap.xml`, sitemap URLs and Production domain, rendered category/product canonical, metadata and Product structured data against actual displayed stock and price; ensure account, checkout and recovery routes are noindex and no Sandbox host is indexable. Search Console indexing remains independently unverified.
- Observe health and errors. If any check fails, keep the gate closed and follow the verified rollback procedure. Separately approve any later registration or live payment activation.
