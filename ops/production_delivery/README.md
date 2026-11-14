# Manual Production storefront delivery

This extends the existing GitHub Actions → AWS OIDC → S3 → fixed SSM document →
versioned releases / atomic symlink pattern. It does not use or change Infra's
attested promoter; its state/lock/journal live in `.manual-control`, separately
from the unused attested promoter's `.control` directory. No signing, Enterprise environments or automatic Production CD.
The existing Sandbox workflow and resources remain unchanged.

## Trust and isolation

Only manual dispatches from `production-storefront-release` can run delivery.
The repository enable variable defaults closed; the operator must confirm the
exact source SHA and explicitly authorize each operation. The AWS role uses the
repository's existing immutable OIDC subject format, but pins the separate release
branch. Sandbox/main, PR and other-repository tokens cannot assume it. No claim
that GitHub Free provides branch protection or environment approvals is made:
repository administrators and changes to this reviewed control branch are trusted.

This reuses the existing OIDC provider and temporary AWS credential mechanism.
It requires a **separate scoped role**, bucket and SSM document; it does not grant
Production rights to the existing Sandbox role. Reusing that role unchanged cannot
provide both a new destination and credential isolation. The proposed role permits
only Production-prefix Put/Get, this instance + this document SendCommand, and
GetCommandInvocation (AWS does not resource-scope that read operation). No IAM,
Secrets Manager, RunShellScript document or nginx-modification permission is added.

The trusted GitHub workflow pins source `fbc860a33b0daf31aad9b1c1667032098dd87e32`,
checks its successful original main CI, verifies repository/clean source and builds
before assuming AWS credentials. Only an explicit environment allowlist reaches
npm. The archive is deterministic and content-addressed; all output is scanned for
private credentials, Test public keys and crossed environment identity. The host
rechecks archive/file hashes and Production metadata on deploy, rollback and
interruption recovery. This is an explicitly different trust model from GitHub
artifact attestation; it does not claim independently signed build provenance.

## Owner prerequisites — not performed by this PR

1. Review and merge this PR, then create the control branch at that reviewed merge.
   Do not move it automatically on normal main pushes. The workflow must exist on
   default main before dispatching it against that branch.
2. Render `python3 ops/production_delivery/template.py > production-delivery.json`.
   Independently review/apply it in account 919693204623 / eu-west-2 with named-IAM
   authorization. These are proposed resources, **not existing installed resources**.
   No existing role policy, bucket or SSM document is replaced. Verify the actual
   role rejects a Sandbox/main token before publication.
3. Configure repository variables `PRODUCTION_STRIPE_PUBLISHABLE_KEY` (the existing
   approved Live **public** key), `PRODUCTION_STRIPE_PUBLISHABLE_KEY_SHA256` (owner
   approved SHA-256 of exact UTF-8 key bytes, without newline). Independently approve
   and review-pin that same value as `APPROVED_KEY_SHA256` in `install.py`, then
   regenerate/review the SSM document. The pin is currently unset: publication and
   retained-release verification fail closed, regardless of supplied variables.
   No approved fingerprint is invented by this PR. Initially leave
   `PRODUCTION_FRONTEND_DELIVERY_ENABLED` absent/false. Never supply a secret key.
4. Independently approve/create root-owned 0755
   `/opt/colorful-life-production/storefront` and its parents. Require an SSM agent
   supporting `interpolationType: ENV_VAR`; unsupported agents fail closed.
5. Review the dedicated Production static root and asset-store nginx prerequisite
   with the routing owner. This PR does **not** change nginx. Preserve the current
   reviewed customer-route include SHA256
   `960c0be2d745373b50eee4c5dcc68a8e6164f24f91e2f944c61b4e15deaad208`, TLS and
   private/checkout restrictions. The serving root must be
   `/opt/colorful-life-production/storefront/current`; `/assets/` must use
   `root /opt/colorful-life-production/storefront/asset-store;` so old browser
   chunks survive activation and rollback. Record/review the full effective nginx
   digest. No existing Sandbox directory can be adopted as a Production baseline.

## Publication and rollback

After separate publication authorization, enable the repository variable and
manually dispatch `.github/workflows/production-storefront-manual.yml` with
`--ref production-storefront-release`, the exact source confirmation, explicit
`authorized=true`, action and owner-reviewed effective nginx digest.

- `prepare` builds Production R0 with registration UI **false** and stages it in
  the isolated directory. It does not change public routing. Its result explicitly
  says the baseline has not yet been publicly verified. If preparation is
  interrupted between pointer/state creation, stop for owner recovery; do not
  adopt an unrecorded pointer or retry blindly.
- Before the separately authorized Production static-root cutover, explicitly set
  `SANDBOX_DEPLOY_ENABLED=false` and verify Sandbox delivery is disabled. This PR
  does not change that setting. Then separately approve the routing owner's
  static-root cutover to R0. Verify the
  site and Production APIs. Keep backend registration and payment initiation OFF.
  Keep Sandbox delivery disabled during cutover. Any later Sandbox re-enablement
  needs separate owner approval and destination/vhost isolation checks; it must
  never replace the Production directory, asset store or public vhost.
- `deploy` builds R1 with `VITE_REGISTRATION_ENABLED=true`, genuine Production
  identity and the approved Live public key. It first verifies the current
  Production baseline is intact **and actually served**, then stages R1, publishes
  append-only hashed assets, journals, switches the symlink and verifies the public
  and loopback TLS index, environment manifest and referenced JS/CSS. Failure
  restores/rechecks the previous verified Production release. No backend switches
  are changed. No customer accounts or payments are created.
- `rollback` verifies the retained previous archive and files before switching.
  If an interruption journal exists, it restores only that journal's recorded
  Production baseline. A failed restoration keeps the journal and evidence.
  Never select the old Sandbox bundle. Releases and hashed assets are not pruned.

Conditional uploads reuse an existing object only after an exact S3 412 response
and an independent download/SHA-256 check; other upload failures remain fatal.
Host-side archive verification is unchanged.

The workflow records one SSM command ID and its bounded waiter result. If still
running, inspect **that ID**; do not redispatch. Logs/archives contain no private
Stripe credentials. A presigned download URL is short-lived and must not be printed.

The installer also requires Backend `045143e` (#242, email-only signup), an active
compatibility boundary, and payment initiation OFF in both runtime settings and
running processes for prepare/deploy. Registration may be ON for deploy; prepare
(the registration-closed baseline) still requires it OFF. Retained releases may come
from any approved source revision (`69ccd28` R0/R1 or `fbc860a`); only `fbc860a` is staged. Rollback alone permits registration/payment
activation and a newer Backend: it still requires an immutable current Production
image, healthy matching API/Worker, consistent recovery pin, active Compatibility
Guard authorization, the approved routing/root and verified retained frontend/key.
Rollback never changes backend switches or restores backend images. Updating the
prepare/deploy source/backend pins still requires a separate reviewed change. Ordinary pushes never deploy Production.

## Focused verification

`python3 -B -m unittest discover -s ops/production_delivery -p 'test_*.py' -v`
uses synthetic public keys, temporary artifacts and mocked host ownership. No AWS,
Production, real key, frontend build or payment-provider request occurs. Static
policy tests demonstrate distinct exact subjects; actual deployed IAM/SSM/vhost
readiness remains an owner publication preflight, not a claim established by CI.
