# Storefront build environment contract v1

Production promotion must build a separate artifact from an exact reviewed Frontend
commit. Never relabel an existing Sandbox archive. No build or manifest authorizes LIVE
activation. No private credentials may be provided to Vite.

| Variable | Production | Sandbox |
| --- | --- | --- |
| VITE_TARGET_ENVIRONMENT | production | sandbox |
| VITE_API_ENVIRONMENT | production | sandbox |
| VITE_PAYMENT_MODE | stripe-live | stripe-sandbox |
| VITE_STRIPE_PUBLISHABLE_KEY | pk_live_ + at least 8 alphanumeric chars | pk_test_ + at least 8 alphanumeric chars |
| VITE_SITE_URL | https://build-and-bloom.co.uk | explicit HTTPS origin |
| VITE_API_BASE_URL | /api OR explicit HTTPS origin, optionally /api | same syntax, explicitly Sandbox routing |
| VITE_SOURCE_REVISION | exact reviewed 40-character lowercase Git commit | exact 40-character lowercase Git commit |
| VITE_SANDBOX_REGISTRATION_ENABLED | absent/empty/false | existing true/false opt-in |
| VITE_PAYPAL_SANDBOX_CLIENT_ID | absent/empty | absent/empty (Stripe-only contract) |

Unknown VITE_* fields, private credential fields/recognisable credentials, missing
required settings, unknown payment modes, mismatched environment declarations/keys,
malformed URLs, userinfo/query/fragment/trailing slash, Production site mismatch and
explicit sandbox/staging API hostnames in Production all reject the build. Public
publishable keys are not secret keys; no sk_*, rk_*, whsec_*, AWS access keys or private
keys belong in the build configuration. Build failures report field classes, not values.

The Stripe loader runs the same validator before calling the pure Stripe SDK loader.
An invalid dev/test configuration returns unavailable without SDK initialisation;
there is no fallback from an unknown mode to either environment. Payment/refund business
logic, confirmation and recovery are unchanged. Local developers must provide explicit
valid Sandbox public settings to exercise Stripe; an unconfigured dev server remains
usable for non-payment work, with Stripe unavailable.

## Artifact contract for Sol's Infra promotion process

Every successful `npm run build` emits `dist/storefront-environment.json`:
- version=1, sourceRevision, target, paymentMode, siteOrigin, apiBase, apiEnvironment;
- SHA256 fingerprint of the configured public publishable key, never the key itself.

Infra must verify those fields against the owner's approved release, verify the archive
SHA256 and all retained file integrity, and authenticate the build's CI provenance.
A JSON manifest is **not** an attestation: anyone can edit it. Bind manifest and archive
to the reviewed source/CI build and owner approval. Rollback must reverify the retained
artifact and its compatible Backend, not just trust its directory name or old manifest.

`/api` is intentionally supported: both environments use the public apex domain today.
Its spelling is not proof of the runtime upstream. Infra must independently verify the
Production route targets port3002/Production Backend and RDS identity, not Sandbox3001,
and verify authoritative Backend mode. `VITE_API_ENVIRONMENT` is an explicit build
assertion, not an observation of that server. No frontend-only check can prove RDS or
secret-key identity. Even a differently named absolute API requires that verification.

Before promotion, Sol must obtain the approved LIVE public key through the existing
owner-controlled configuration mechanism (do not print it), pin source revision, and
supply every Production variable above. No Production workflow or credentials are
introduced by this PR. The existing release workflow remains main-only/Sandbox-gated;
it now requires SANDBOX_PAYMENT_MODE=stripe-sandbox and the existing TEST public-key
variable. Missing mode fails rather than silently defaulting to historical PayPal.
Its verification job uses synthetic TEST settings; that artifact is Sandbox-labelled
and must never be promoted to Production.

## Offline verification

```
npm ci
npm run test:run
npm run lint
npx tsc -b --noEmit
npm run test:contracts
npm run legal:check
```

A synthetic Sandbox build (no Stripe requests):
```
VITE_TARGET_ENVIRONMENT=sandbox VITE_API_ENVIRONMENT=sandbox \
VITE_PAYMENT_MODE=stripe-sandbox VITE_SITE_URL=https://build-and-bloom.co.uk \
VITE_API_BASE_URL=/api VITE_STRIPE_PUBLISHABLE_KEY=pk_test_syntheticBuildOnly12345 \
VITE_SOURCE_REVISION=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa npm run build
cat dist/storefront-environment.json
sha256sum dist/storefront-environment.json
```

The suite performs actual isolated Vite builds for synthetic Production and Sandbox
settings and checks rejected builds. Synthetic LIVE-prefixed strings are invalid Stripe
credentials, used only in offline tests; no SDK/provider requests occur. Tests verify
runtime failure before SDK load and retain existing Sandbox lazy-load/checkout coverage.
Artifact archive hashing/attestation and real domain checks belong to Infra's separately
reviewed promotion path. Deployment, LIVE activation and merging remain unauthorized.
