# Help & FAQs — V1 review handoff

## Source and scope

Independent feature branch from frontend main e9ca61d (PR #90). No changes imported from PR #91 or #88. The owner supplied the approved architecture and policy decisions in conversation. A saved Claude FAQ draft was not found in the repositories; the 24 conservative answers here are a new review candidate based on the approved decisions and current code, not a claim to reproduce an unseen draft.

Static typed content: src/features/help/faq.tsx. Native details/summary; no dependency, backend, payment, database or infrastructure changes. Help reuses the existing Customer Information page registry, index, document shell and book navigation. /help is a distinct canonical route, not a new /legal/help URL. The registry's internal LegalSlug naming is retained to avoid refactoring.

## Content evidence and exclusions

- Choosing a set (5): existing catalogue/search, product offer selector, condition description and product age/availability UI. Product conditions use current approved New / New – Outer Box Damage definitions; no retired-set definition.
- Delivery (5): approved UK-wide policy and normal 2–3-working-day dispatch. Includes dispatch-email/My Orders tracking guidance. No fixed prices or guaranteed dates; charges/estimates refer to the current checkout/legal delivery table. Northern Ireland operational/carrier/fee verification is still outstanding in the policy workstream; Help does not certify coverage or silently modify checkout.
- Orders/payments (4): existing My Orders and payment-window recovery, with no wallet promise or provider-redirect success claim. Dispatch-email contract acceptance follows owner policy in PR #91; Backend durable email consistency remains separately outstanding.
- Cancellations/returns/refunds (6): owner-approved statutory periods, direct return costs with pre-purchase disclosure, no blanket opened-set refusal, lawful diminished-value deductions, statutory refund deadline and standard delivery reimbursement. No bank/provider posting-time promise. Full instructions link to legal pages; return address is not duplicated here.
- Account/support (4): existing verification/resend/password-reset UI; personal-data requests go to COMPANY.supportEmail. No claim that self-service export works or all records are deleted on account closure. Complaint initial response is a target, not support hours or a resolution deadline.

Before release: review Help against the final merged wording of #91 and the return-address correction #88. Retention/transfer privacy checks, Northern Ireland operational questions and Backend acknowledgment/dispatch-email changes are NOT resolved by this Help PR. They do not block local Help development but must be considered in the final release decision. Do not merge/deploy until owner and independent review approve the combined customer-facing wording.

## Navigation and accessibility

Contents enables Help & FAQs. The desktop painted Customer Information notebook keeps its label and opens /help, as does its existing fallback. Mobile Help appears before Account and Cart, preserving Cart as the last control for the existing focus-return fallback. The shared information index/footer includes Help.

Category anchors and stable /help#question-id links open the target accordion and focus its summary. Initial deep-link focus is deferred one frame and reapplied after the book's spread reset so category-loading re-renders cannot override it. Invalid/unknown fragments are ignored. Enter/Space activation and expanded state are native browser behaviour. No custom animation is introduced; book reduced-motion behaviour is reused.

Metadata uses the existing route-head path: title Help & FAQs | Build & Bloom, a specific description, /help canonical and index,follow. All answers exist as text in the rendered DOM, even while accordions are closed. This SPA retains its existing client rendering; no SSR or FAQ rich-result claim is introduced. Backend sitemap addition is a separate follow-up; no Backend change was made.

## Validation evidence

Automated checks and browser results are reported in the PR and final owner handoff. Local browser evidence is under /tmp/help-review/; scripts use production dist and isolated fixture API responses only, with no real account/payment/data writes. Review includes desktop, tablet/mobile, paper scrolling, accordion keyboard/deep links, page turning, mobile control spacing and reduced motion. No screenshots or generated build files enter Git.

Final local checks: full Vitest 1,167 passed / 0 failed (101 files); full ESLint, TypeScript, shared-contract check and production build passed. Production Chrome and Firefox checks passed at 1920×1080, 1440×900, 768×1024 and 390×844. Normal book motion at 1440 and reduced motion at other sizes were exercised. Deep-link open/focus, native Enter/Space toggles, category links, page turns, mobile Help and metadata were checked. No horizontal page/viewport overflow or JavaScript exceptions observed. On mobile the three controls fit one row with 6px gaps. Example right-page clientHeight/scrollHeight at 1440: Chrome 529/2052px, Firefox 529/2075px; long answers remain reachable through paper scrolling.


## Independent-review corrections

The payment answer names card payments processed by Stripe only. Current `src/components/checkout/Checkout.tsx` renders PayPal buttons only behind `sandboxCheckout`; no production PayPal readiness has been verified. Do not add PayPal as a live method until that dependency is independently verified. Live-provider activation itself was not changed or tested by this frontend task. No Sandbox instructions remain in the payment FAQ.

Return postage uses the exact approved short answer and links to Delivery & Returns for full statutory rules; related answers use plain language without automatic opened-set deductions or bank-posting guarantees. One tracking question brings the total to 24. The permalink uses its visible label as its accessible name (redundant aria-label removed). Notebook/fallback accessible descriptions now say Help & FAQs. Category-anchor focus and exact payment/postage/tracking wording have dedicated tests.

The existing mobile Help/Account/Cart controls now have min-width/min-height 44px. No book dimensions or Account/Cart handlers changed. Browser evidence from this correction is under /tmp/help-review-fixes/.

**Release order is mandatory: #88, then #91, then #92, with owner approval.** Main auto-deploys. #91 still has unresolved legal:check requirements; this independent feature branch neither removes nor bypasses that gate. Do not merge or deploy Help simply because its independent CI passes.

**Separate pre-launch defect for a future task:** frontend `src/features/account/privacyApi.ts` calls POST /users/me/data-export, but the reviewed Backend main routes do not implement it. Help directs data-access requests to the support email. This PR does not add the endpoint or promise the existing export UI works.

Final correction checks: full frontend suite 1,169 passed; focused Help/navigation/fallback tests 17 passed; ESLint, TypeScript, contracts and production build passed. Correction browser checks passed in Chrome and Firefox at 1920×1080, 1440×900, 768×1024, 390×844 and 320×740. Mobile targets were all at least 44×44px, with 6px gaps and no overlap. Keyboard category activation/focus, deep links, native accordion toggles, page turns and mobile Help navigation passed. No horizontal overflow or JavaScript exceptions were observed. Screenshots and measured paper clientHeight/scrollHeight are in /tmp/help-review-fixes/ and /tmp/help-review-fixes-browser.log. Earlier results above are retained for traceability.
