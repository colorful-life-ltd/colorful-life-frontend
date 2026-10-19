# Coordinated integration — Backend issue #211

This branch implements the Storefront side of the [single master issue](https://github.com/colorful-life-ltd/colorful-life-backend/issues/211). Full independent baseline: Backend PR #210. Backend `docs/integration/211-three-system-handoff.md` contains the coordinated acceptance map and release order.

The owner-filtered order projection now supplies minimal refund/cancellation/return information alongside fulfilment progress. The customer view validates these fields, distinguishes uncertain refunds from confirmed refunds, shows Preparing/In transit/Delivered and safe tracking links, and explains that returns and refunds are separate. Return writes remain ADMIN-only; the Storefront tells customers to arrange returns with the team and displays their recorded progress. No authorization contract is widened.

Catalogue state is explicit Backend policy: More on the Way requires a genuine restock expectation; Discontinued is set manually by an ADMIN only after definitive confirmation of no future restock or sale. Never infer discontinuation from zero stock, age or absent supplier information. Unknown restock status shows Sold Out. Neither state permits backorders. Existing orders and previously public product detail URLs remain intact. Discontinued or unpublished offers cannot be selected for purchase.

`contracts/integration-v1.json` is the byte-identical Backend-owned fixture. `npm run test:contracts` verifies it against the immutable commit in `contracts/backend-ref.txt`; local unpushed development can use `BACKEND_CONTRACT_FILE`. Unit tests, no-emit typechecking and lint run without an application build/start. Builds and CI execution remain gated by explicit owner approval. No deployment or merge is automatic.

Before rollout, deploy the additive Backend migration/API, complete unit/contract/full Backend tests and owner-approved builds, and test signed provider events, carrier updates and real three-system behaviour in an isolated environment. No production resource or real provider mutation is part of these tests.
